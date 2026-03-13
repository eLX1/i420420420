/*
    Copyright (C) 2024 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus
*/

const Builder = require('@discordjs/builders');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

// Store vending profit tracking intervals
const vendingProfitIntervals = new Map();

// Store vending profit message IDs
const vendingProfitMessages = new Map();

// Store previous stock levels for comparison
const previousStockLevels = new Map();

module.exports = {
    name: 'vendingprofit',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('vendingprofit')
            .setDescription(client.intlGet(guildId, 'commandsVendingProfitDesc'))
            .addSubcommand(subcommand => subcommand
                .setName('start')
                .setDescription(client.intlGet(guildId, 'commandsVendingProfitStartDesc'))
                .addStringOption(option => option
                    .setName('shop_name')
                    .setDescription(client.intlGet(guildId, 'theNameOfYourShop'))
                    .setRequired(true)))
            .addSubcommand(subcommand => subcommand
                .setName('stop')
                .setDescription(client.intlGet(guildId, 'commandsVendingProfitStopDesc')))
            .addSubcommand(subcommand => subcommand
                .setName('status')
                .setDescription(client.intlGet(guildId, 'commandsVendingProfitStatusDesc')))
            .addSubcommand(subcommand => subcommand
                .setName('reset')
                .setDescription(client.intlGet(guildId, 'commandsVendingProfitResetDesc')))
            .addSubcommand(subcommand => subcommand
                .setName('addprofit')
                .setDescription(client.intlGet(guildId, 'commandsVendingProfitAddProfitDesc'))
                .addStringOption(option => option
                    .setName('item_name')
                    .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                    .setRequired(true))
                .addIntegerOption(option => option
                    .setName('quantity')
                    .setDescription(client.intlGet(guildId, 'theQuantitySold'))
                    .setRequired(true))
                .addIntegerOption(option => option
                    .setName('price')
                    .setDescription(client.intlGet(guildId, 'thePricePerItem'))
                    .setRequired(true))
                .addStringOption(option => option
                    .setName('currency')
                    .setDescription(client.intlGet(guildId, 'theCurrencyUsed'))
                    .setRequired(true)));
    },

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = client.rustplusInstances[interaction.guildId];

        if (!rustplus || !rustplus.isOperational) {
            const str = client.intlGet(interaction.guildId, 'botNotOperational');
            await interaction.reply({
                embeds: [DiscordEmbeds.getEmbed({
                    title: 'Error',
                    description: str,
                    color: 0xff0000
                })]
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'start': {
                const shopName = interaction.options.getString('shop_name');
                
                // Initialize vending profit tracking in instance data
                instance.vendingProfit = {
                    shopName: shopName,
                    isRunning: true,
                    startTime: Date.now(),
                    totalProfit: 0,
                    totalSales: 0,
                    salesHistory: [],
                    lastCheck: Date.now(),
                    messageId: null,
                    channelId: null
                };

                // Create or get the vending-profits channel
                let channel = interaction.guild.channels.cache.find(c => c.name === 'vending-profits');
                if (!channel) {
                    channel = await interaction.guild.channels.create({
                        name: 'vending-profits',
                        type: 0,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                allow: [PermissionsBitField.Flags.ViewChannel],
                                deny: [PermissionsBitField.Flags.SendMessages]
                            }
                        ]
                    });
                }

                instance.vendingProfit.channelId = channel.id;

                // Send initial message
                const initialEmbed = new EmbedBuilder()
                    .setTitle('Vending Machine Profit Tracker')
                    .setDescription(`Profit tracking started for shop: ${shopName}\nWaiting for first sales data...`)
                    .setColor('#00ff00')
                    .setTimestamp();

                const message = await channel.send({ embeds: [initialEmbed] });
                instance.vendingProfit.messageId = message.id;
                vendingProfitMessages.set(interaction.guildId, message.id);

                // Initialize previous stock levels
                previousStockLevels.set(interaction.guildId, new Map());

                // Start the profit tracking interval (check every 1 second)
                if (!vendingProfitIntervals.has(interaction.guildId)) {
                    const interval = setInterval(async () => {
                        try {
                            await trackVendingProfits(client, interaction.guildId);
                        } catch (error) {
                            client.log('Error', `Error in vending profit tracking interval: ${error.message}`);
                        }
                    }, 1000); // Check every 1 second
                    vendingProfitIntervals.set(interaction.guildId, interval);
                }

                await interaction.reply({
                    embeds: [DiscordEmbeds.getEmbed({
                        title: 'Success',
                        description: `Started profit tracking for shop: ${shopName}`,
                        color: 0x00ff00
                    })],
                    ephemeral: true
                });
                break;
            }

            case 'stop': {
                if (instance.vendingProfit) {
                    instance.vendingProfit.isRunning = false;
                    if (vendingProfitIntervals.has(interaction.guildId)) {
                        clearInterval(vendingProfitIntervals.get(interaction.guildId));
                        vendingProfitIntervals.delete(interaction.guildId);
                    }
                    // Clear the message ID
                    vendingProfitMessages.delete(interaction.guildId);
                    instance.vendingProfit.messageId = null;
                    const str = client.intlGet(interaction.guildId, 'vendingProfitStopped');
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str), { ephemeral: true });
                } else {
                    const str = client.intlGet(interaction.guildId, 'vendingProfitNotRunning');
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str), { ephemeral: true });
                }
                break;
            }

            case 'status': {
                if (!instance.vendingProfit || !instance.vendingProfit.isRunning) {
                    const str = client.intlGet(interaction.guildId, 'vendingProfitNotRunning');
                    await interaction.reply({
                        embeds: [DiscordEmbeds.getEmbed({
                            title: 'Vending Profit Status',
                            description: str,
                            color: 0xff0000
                        })],
                        ephemeral: true
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle('Vending Profit Status')
                    .setDescription(`Profit tracking is running for shop: ${instance.vendingProfit.shopName}`)
                    .setColor('#00ff00')
                    .addFields(
                        {
                            name: 'Total Profit',
                            value: `${instance.vendingProfit.totalProfit} scrap`,
                            inline: true
                        },
                        {
                            name: 'Total Sales',
                            value: `${instance.vendingProfit.totalSales} items`,
                            inline: true
                        },
                        {
                            name: 'Running Time',
                            value: formatRunningTime(instance.vendingProfit.startTime),
                            inline: true
                        },
                        {
                            name: 'Last Check',
                            value: new Date(instance.vendingProfit.lastCheck).toLocaleString('en-US', { timeZone: 'Europe/Athens' })
                        }
                    );

                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
            }

            case 'reset': {
                if (instance.vendingProfit) {
                    instance.vendingProfit.totalProfit = 0;
                    instance.vendingProfit.totalSales = 0;
                    instance.vendingProfit.salesHistory = [];
                    instance.vendingProfit.startTime = Date.now();
                    client.setInstance(interaction.guildId, instance);
                    
                    const str = client.intlGet(interaction.guildId, 'vendingProfitReset');
                    await interaction.reply({
                        embeds: [DiscordEmbeds.getEmbed({
                            title: 'Success',
                            description: str,
                            color: 0x00ff00
                        })],
                        ephemeral: true
                    });
                } else {
                    const str = client.intlGet(interaction.guildId, 'vendingProfitNotRunning');
                    await interaction.reply({
                        embeds: [DiscordEmbeds.getEmbed({
                            title: 'Error',
                            description: str,
                            color: 0xff0000
                        })],
                        ephemeral: true
                    });
                }
                break;
            }

            case 'addprofit': {
                const itemName = interaction.options.getString('item_name');
                const quantity = interaction.options.getInteger('quantity');
                const price = interaction.options.getInteger('price');
                const currency = interaction.options.getString('currency');

                if (!instance.vendingProfit) {
                    const str = client.intlGet(interaction.guildId, 'vendingProfitNotRunning');
                    await interaction.reply({
                        embeds: [DiscordEmbeds.getEmbed({
                            title: 'Error',
                            description: str,
                            color: 0xff0000
                        })],
                        ephemeral: true
                    });
                    return;
                }

                const totalProfit = price * quantity;
                instance.vendingProfit.totalProfit += totalProfit;
                instance.vendingProfit.totalSales += quantity;
                
                // Add to sales history
                const saleRecord = {
                    itemName: itemName,
                    quantity: quantity,
                    pricePerItem: price,
                    totalProfit: totalProfit,
                    currency: currency,
                    timestamp: Date.now()
                };
                instance.vendingProfit.salesHistory.push(saleRecord);

                client.setInstance(interaction.guildId, instance);

                const str = client.intlGet(interaction.guildId, 'vendingProfitAdded');
                await interaction.reply({
                    embeds: [DiscordEmbeds.getEmbed({
                        title: 'Profit Added',
                        description: `${str}: ${quantity}x ${itemName} for ${totalProfit} ${currency}`,
                        color: 0x00ff00
                    })],
                    ephemeral: true
                });
                break;
            }
        }
    }
};

async function trackVendingProfits(client, guildId) {
    // Check if client.getInstance method exists
    if (!client.getInstance) return;
    
    const instance = client.getInstance(guildId);
    
    // Check if client.rustplusInstances exists
    if (!client.rustplusInstances) return;
    
    const rustplus = client.rustplusInstances[guildId];

    if (!instance.vendingProfit || !instance.vendingProfit.isRunning) return;

    // Check if rustplus instance exists and is operational
    if (!rustplus || !rustplus.isOperational) return;

    // Check if mapMarkers exists
    if (!rustplus.mapMarkers || !rustplus.mapMarkers.vendingMachines) return;

    const shopName = instance.vendingProfit.shopName;
    const channel = await client.channels.fetch(instance.vendingProfit.channelId);
    if (!channel) return;

    // Get your shop's vending machines
    const yourVendingMachines = rustplus.mapMarkers.vendingMachines.filter(
        vm => vm.name && vm.name.toLowerCase().includes(shopName.toLowerCase())
    );

    if (yourVendingMachines.length === 0) return;

    const currentStockLevels = new Map();
    const previousLevels = previousStockLevels.get(guildId) || new Map();
    let hasChanges = false;

    // Collect current stock levels
    for (const vm of yourVendingMachines) {
        if (!vm.sellOrders || !vm.location) continue;
        for (const order of vm.sellOrders) {
            const key = `${vm.location.string}-${order.itemId}-${order.currencyId}`;
            currentStockLevels.set(key, {
                amountInStock: order.amountInStock,
                itemId: order.itemId,
                currencyId: order.currencyId,
                costPerItem: order.costPerItem,
                quantity: order.quantity,
                location: vm.location.string
            });
        }
    }

    // Check for stock changes (sales)
    for (const [key, currentStock] of currentStockLevels) {
        const previousStock = previousLevels.get(key);
        
        if (previousStock && currentStock.amountInStock < previousStock.amountInStock) {
            const itemsSold = previousStock.amountInStock - currentStock.amountInStock;
            const profit = itemsSold * currentStock.costPerItem;
            
            // Add to profit tracking
            instance.vendingProfit.totalProfit += profit;
            instance.vendingProfit.totalSales += itemsSold;
            
            // Add to sales history
            const itemName = client.items && client.items.getName ? client.items.getName(currentStock.itemId) : `Item ${currentStock.itemId}`;
            const currencyName = client.items && client.items.getName ? client.items.getName(currentStock.currencyId) : `Currency ${currentStock.currencyId}`;
            
            const saleRecord = {
                itemName: itemName,
                quantity: itemsSold,
                pricePerItem: currentStock.costPerItem,
                totalProfit: profit,
                currency: currencyName,
                timestamp: Date.now(),
                location: currentStock.location
            };
            instance.vendingProfit.salesHistory.push(saleRecord);
            
            hasChanges = true;
            
            // Send in-game notification for significant sales
            if (profit >= 100 && rustplus.sendTeamMessage) {
                try {
                    rustplus.sendTeamMessage(`Sale: ${itemsSold}x ${itemName} for ${profit} ${currencyName}`);
                } catch (error) {
                    client.log('Error', `Failed to send team message: ${error.message}`);
                }
            }
        }
    }

    // Update previous stock levels
    previousStockLevels.set(guildId, currentStockLevels);

    // Update Discord message if there are changes
    if (hasChanges) {
        await updateVendingProfitMessage(client, guildId, channel);
        if (client.setInstance) {
            client.setInstance(guildId, instance);
        }
    }

    // Update last check time
    instance.vendingProfit.lastCheck = Date.now();
}

async function updateVendingProfitMessage(client, guildId, channel) {
    // Check if client.getInstance method exists
    if (!client.getInstance) return;
    
    const instance = client.getInstance(guildId);
    
    // Check if instance and vendingProfit exist
    if (!instance || !instance.vendingProfit) {
        if (client.log) {
            client.log('Error', `Instance or vendingProfit not found for guild ${guildId}`);
        }
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('Vending Machine Profit Tracker')
        .setDescription(`Live profit tracking for: ${instance.vendingProfit.shopName}`)
        .setColor('#00ff00')
        .setTimestamp()
        .addFields(
            {
                name: '💰 Total Profit',
                value: `${instance.vendingProfit.totalProfit} scrap`,
                inline: true
            },
            {
                name: '📦 Total Sales',
                value: `${instance.vendingProfit.totalSales} items`,
                inline: true
            },
            {
                name: '⏱️ Running Time',
                value: formatRunningTime(instance.vendingProfit.startTime),
                inline: true
            }
        );

    // Add recent sales (last 5)
    const recentSales = instance.vendingProfit.salesHistory.slice(-5);
    if (recentSales.length > 0) {
        let recentSalesText = '';
        for (const sale of recentSales.reverse()) {
            const timeAgo = formatTimeAgo(sale.timestamp);
            recentSalesText += `• ${sale.quantity}x ${sale.itemName} - ${sale.totalProfit} ${sale.currency} (${timeAgo})\n`;
        }
        embed.addFields({
            name: '🔄 Recent Sales',
            value: recentSalesText
        });
    }

    // Update or send message
    try {
        const messageId = instance.vendingProfit.messageId || vendingProfitMessages.get(guildId);
        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                await message.edit({ embeds: [embed] });
            } catch (error) {
                // If message not found, send a new one
                const newMessage = await channel.send({ embeds: [embed] });
                instance.vendingProfit.messageId = newMessage.id;
                vendingProfitMessages.set(guildId, newMessage.id);
            }
        } else {
            // If no message ID stored, send a new message
            const newMessage = await channel.send({ embeds: [embed] });
            instance.vendingProfit.messageId = newMessage.id;
            vendingProfitMessages.set(guildId, newMessage.id);
        }
    } catch (error) {
        client.log('Error', `Failed to update vending profit message: ${error.message}`);
    }
}

function formatRunningTime(startTime) {
    const now = Date.now();
    const diff = now - startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
        return `${minutes}m ago`;
    } else {
        return `${seconds}s ago`;
    }
}

// Add auto-resume functionality
module.exports.onReady = async function(client) {
    client.log('Info', 'Vending profit tracker initialized');
    
    // Resume profit tracking for all guilds
    for (const [guildId, instance] of Object.entries(client.instances)) {
        try {
            if (instance.vendingProfit && instance.vendingProfit.isRunning) {
                // Start the profit tracking interval
                if (!vendingProfitIntervals.has(guildId)) {
                    const interval = setInterval(async () => {
                        try {
                            await trackVendingProfits(client, guildId);
                        } catch (error) {
                            client.log('Error', `Error in vending profit tracking interval: ${error.message}`);
                        }
                    }, 1000); // Check every 1 second
                    vendingProfitIntervals.set(guildId, interval);
                }
                
                // Initialize previous stock levels if not exists
                if (!previousStockLevels.has(guildId)) {
                    previousStockLevels.set(guildId, new Map());
                }
                
                client.log('Info', `Resumed vending profit tracking for guild ${guildId}`);
            }
        } catch (error) {
            client.log('Error', `Failed to resume vending profit tracking for guild ${guildId}: ${error.message}`);
        }
    }
}; 