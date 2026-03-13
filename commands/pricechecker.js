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
const Axios = require('axios');

const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

// Store price checker intervals in a separate Map
const priceCheckerIntervals = new Map();

// Store price checker message IDs
const priceCheckerMessages = new Map();

module.exports = {
    name: 'pricechecker',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('pricechecker')
            .setDescription(client.intlGet(guildId, 'commandsPriceCheckerDesc'))
            .addSubcommand(subcommand => subcommand
                .setName('start')
                .setDescription(client.intlGet(guildId, 'commandsPriceCheckerStartDesc'))
                .addStringOption(option => option
                    .setName('name')
                    .setDescription(client.intlGet(guildId, 'theNameOfYourShop'))
                    .setRequired(true))
                .addStringOption(option => option
                    .setName('webhook')
                    .setDescription('Optional: Discord webhook URL to send notifications to another server')
                    .setRequired(false)))
            .addSubcommand(subcommand => subcommand
                .setName('stop')
                .setDescription(client.intlGet(guildId, 'commandsPriceCheckerStopDesc')))
            .addSubcommand(subcommand => subcommand
                .setName('status')
                .setDescription('Show the current status of the price checker'));
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
                const shopName = interaction.options.getString('name');
                const webhookUrl = interaction.options.getString('webhook');
                
                // Store the shop name and webhook in the instance data
                instance.priceChecker = {
                    shopName: shopName,
                    isRunning: true,
                    lastCheck: Date.now(),
                    prices: new Map(),
                    messageId: null, // Add messageId to store the message ID
                    webhookUrl: webhookUrl || null
                };

                // Create or get the price-checker channel
                let channel = interaction.guild.channels.cache.find(c => c.name === 'price-checker');
                if (!channel) {
                    channel = await interaction.guild.channels.create({
                        name: 'price-checker',
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

                instance.priceChecker.channelId = channel.id;

                // Send initial message
                const initialEmbed = new EmbedBuilder()
                    .setTitle('Price Checker Status')
                    .setDescription(`Price checker is running for shop: ${shopName}\nWaiting for first price check...`)
                    .setColor('#00ff00')
                    .setTimestamp();

                const message = await channel.send({ embeds: [initialEmbed] });
                instance.priceChecker.messageId = message.id;
                priceCheckerMessages.set(interaction.guildId, message.id);

                // Start the price checking interval
                if (!priceCheckerIntervals.has(interaction.guildId)) {
                    const interval = setInterval(async () => {
                        try {
                            await checkPrices(client, interaction.guildId);
                        } catch (error) {
                            client.log('Error', `Error in price checking interval: ${error.message}`);
                        }
                    }, 900000); // Check every 15 minutes (900000 milliseconds)
                    priceCheckerIntervals.set(interaction.guildId, interval);
                }

                await interaction.reply({
                    embeds: [DiscordEmbeds.getEmbed({
                        title: 'Success',
                        description: `Started checking prices for shop: ${shopName}`,
                        color: 0x00ff00
                    })],
                    ephemeral: true
                });
                break;
            }

            case 'stop': {
                if (instance.priceChecker) {
                    instance.priceChecker.isRunning = false;
                    if (priceCheckerIntervals.has(interaction.guildId)) {
                        clearInterval(priceCheckerIntervals.get(interaction.guildId));
                        priceCheckerIntervals.delete(interaction.guildId);
                    }
                    // Clear the message ID
                    priceCheckerMessages.delete(interaction.guildId);
                    instance.priceChecker.messageId = null;
                    const str = client.intlGet(interaction.guildId, 'priceCheckerStopped');
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str), { ephemeral: true });
                } else {
                    const str = client.intlGet(interaction.guildId, 'priceCheckerNotRunning');
                    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str), { ephemeral: true });
                }
                break;
            }

            case 'status': {
                if (!instance.priceChecker || !instance.priceChecker.isRunning) {
                    const str = client.intlGet(interaction.guildId, 'priceCheckerNotRunning');
                    await interaction.reply({
                        embeds: [DiscordEmbeds.getEmbed({
                            title: 'Price Checker Status',
                            description: str,
                            color: 0xff0000
                        })],
                        ephemeral: true
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle('Price Checker Status')
                    .setDescription(`Price checker is running for shop: ${instance.priceChecker.shopName}`)
                    .setColor('#00ff00')
                    .addFields({
                        name: 'Last Check',
                        value: new Date(instance.priceChecker.lastCheck).toLocaleString('en-US', { timeZone: 'Europe/Athens' })
                    });

                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
            }
        }
    }
};

async function checkPrices(client, guildId) {
    const instance = client.getInstance(guildId);
    const rustplus = client.rustplusInstances[guildId];

    // Fetch fresh vending machine data before checking prices
    let mapMarkersResponse = await rustplus.getMapMarkersAsync();
    if (mapMarkersResponse && mapMarkersResponse.mapMarkers) {
        const MapMarkers = require('../structures/MapMarkers.js');
        rustplus.mapMarkers = new MapMarkers(mapMarkersResponse.mapMarkers, rustplus, client);
    }

    if (!instance.priceChecker || !instance.priceChecker.isRunning) return;

    const yourShopName = instance.priceChecker.shopName;
    const channel = await client.channels.fetch(instance.priceChecker.channelId);
    if (!channel) return;

    // Get your shop's vending machines
    const yourVendingMachines = rustplus.mapMarkers.vendingMachines.filter(
        vm => vm.name.toLowerCase().includes(yourShopName.toLowerCase())
    );

    if (yourVendingMachines.length === 0) return;

    // Collect all items and their prices from your shop
    const yourItems = new Map();
    for (const vm of yourVendingMachines) {
        if (!vm.sellOrders) continue;
        for (const order of vm.sellOrders) {
            if (order.amountInStock === 0) continue;
            const key = `${order.itemId}-${order.currencyId}`;
            if (!yourItems.has(key) || order.costPerItem < yourItems.get(key).price) {
                yourItems.set(key, {
                    itemId: order.itemId,
                    currencyId: order.currencyId,
                    quantity: order.quantity,
                    price: order.costPerItem,
                    amountInStock: order.amountInStock,
                    location: vm.location.string
                });
            }
        }
    }

    // Find best better prices from other shops (only one per item)
    const bestBetterPrices = new Map();
    for (const vm of rustplus.mapMarkers.vendingMachines) {
        if (vm.name.toLowerCase().includes(yourShopName.toLowerCase())) continue;
        if (!vm.sellOrders) continue;

        for (const order of vm.sellOrders) {
            if (order.amountInStock === 0) continue;
            const key = `${order.itemId}-${order.currencyId}`;
            if (yourItems.has(key)) {
                const yourItem = yourItems.get(key);
                if (order.costPerItem < yourItem.price) {
                    // Only keep the best (lowest) price for this item
                    if (!bestBetterPrices.has(key) || order.costPerItem < bestBetterPrices.get(key).price) {
                        bestBetterPrices.set(key, {
                            itemId: order.itemId,
                            currencyId: order.currencyId,
                            quantity: order.quantity,
                            price: order.costPerItem,
                            amountInStock: order.amountInStock,
                            location: vm.location.string,
                            yourPrice: yourItem.price,
                            yourLocation: yourItem.location
                        });
                    }
                }
            }
        }
    }

    // Create embed message
    const embed = new EmbedBuilder()
        .setTitle('Price Comparison Results')
        .setDescription('Here are the items with lower prices found in other vending machines.')
        .setColor('#00ff00')
        .setTimestamp();

    if (bestBetterPrices.size > 0) {
        for (const item of bestBetterPrices.values()) {
            const itemName = client.items.getName(item.itemId);
            const currencyName = client.items.getName(item.currencyId);
            embed.addFields({
                name: `Item: ${itemName}`,
                value: `Your Price: ${item.yourPrice} ${currencyName}\n` +
                       `Lower Price: ${item.price} ${currencyName} at ${item.location}\n` +
                       `Stack: ${item.quantity} ${itemName} for ${item.price} ${currencyName}`
            });
        }
    } else {
        embed.setDescription('No better prices found in other vending machines.');
    }

    // Update or send message
    try {
        const messageId = instance.priceChecker.messageId || priceCheckerMessages.get(guildId);
        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                await message.edit({ embeds: [embed] });
            } catch (error) {
                // If message not found, send a new one
                const newMessage = await channel.send({ embeds: [embed] });
                instance.priceChecker.messageId = newMessage.id;
                priceCheckerMessages.set(guildId, newMessage.id);
            }
        } else {
            // If no message ID stored, send a new message
            const newMessage = await channel.send({ embeds: [embed] });
            instance.priceChecker.messageId = newMessage.id;
            priceCheckerMessages.set(guildId, newMessage.id);
        }
    } catch (error) {
        client.log('Error', `Failed to update price checker message: ${error.message}`);
    }

    // Send to webhook if configured
    if (instance.priceChecker.webhookUrl) {
        try {
            // Discord webhook expects { content, embeds: [embed] }
            // Convert EmbedBuilder to raw JSON
            const webhookPayload = {
                username: 'Rust++ Price Checker',
                avatar_url: 'https://files.facepunch.com/lewis/1b2411b1/og-image.jpg',
                embeds: [embed.toJSON()]
            };
            await Axios.post(instance.priceChecker.webhookUrl, webhookPayload);
        } catch (err) {
            client.log('Error', `Failed to send price checker webhook: ${err.message}`);
        }
    }

    // Send in-game notification only if better prices were found
    if (bestBetterPrices.size > 0) {
        rustplus.sendTeamMessage('New Prices Found! Check Discord');
    }

    // Update last check time
    instance.priceChecker.lastCheck = Date.now();
    client.setInstance(guildId, instance);
}

// Add auto-resume functionality
module.exports.onReady = async function(client) {
    client.log('Info', 'Price checker initialized');
    
    // Resume price checking for all guilds
    for (const [guildId, instance] of client.instances) {
        try {
            if (instance.priceChecker && instance.priceChecker.isRunning) {
                // Start the price checking interval
                if (!priceCheckerIntervals.has(guildId)) {
                    const interval = setInterval(async () => {
                        try {
                            await checkPrices(client, guildId);
                        } catch (error) {
                            client.log('Error', `Error in price checking interval: ${error.message}`);
                        }
                    }, 900000); // Check every 15 minutes
                    priceCheckerIntervals.set(guildId, interval);
                }
                
                client.log('Info', `Resumed price checking for guild ${guildId}`);
            }
        } catch (error) {
            client.log('Error', `Failed to resume price checking for guild ${guildId}: ${error.message}`);
        }
    }
}; 