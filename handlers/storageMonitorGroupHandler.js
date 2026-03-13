/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

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

const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = {
    handler: async function (rustplus, client) {
    },

    updateStorageMonitorGroupIfContainMonitor: async function (client, guildId, serverId, monitorId) {
        const instance = client.getInstance(guildId);

        for (const [groupId, content] of Object.entries(instance.serverList[serverId].storageMonitorGroups)) {
            if (content.monitors.includes(`${monitorId}`)) {
                await DiscordMessages.sendStorageMonitorGroupMessage(guildId, serverId, groupId);
            }
        }
    },

    getGroupsFromMonitorList: function (client, guildId, serverId, monitors) {
        const instance = client.getInstance(guildId);

        let groupsId = [];
        for (let entity of monitors) {
            for (const [groupId, content] of Object.entries(instance.serverList[serverId].storageMonitorGroups)) {
                if (content.monitors.includes(entity) && !groupsId.includes(groupId)) {
                    groupsId.push(groupId);
                }
            }
        }

        return groupsId;
    },

    getTotalItemsInGroup: async function (client, rustplus, guildId, serverId, groupId) {
        const instance = client.getInstance(guildId);
        const group = instance.serverList[serverId].storageMonitorGroups[groupId];
        
        if (!group) return null;

        const itemMap = new Map();
        let totalItems = 0;

        for (const monitorId of group.monitors) {
            if (!instance.serverList[serverId].storageMonitors[monitorId]) continue;
            
            const info = await rustplus.getEntityInfoAsync(monitorId);
            if (!(await rustplus.isResponseValid(info))) continue;

            const items = info.entityInfo.payload.items;
            for (const item of items) {
                const itemName = client.items.getName(item.itemId);
                if (itemMap.has(itemName)) {
                    itemMap.set(itemName, itemMap.get(itemName) + item.quantity);
                } else {
                    itemMap.set(itemName, item.quantity);
                }
                totalItems += item.quantity;
            }
        }

        return {
            items: Array.from(itemMap.entries()).map(([name, quantity]) => ({ name, quantity })),
            totalItems
        };
    },

    findItemInGroup: async function (client, rustplus, guildId, serverId, groupId, searchItem) {
        const instance = client.getInstance(guildId);
        const group = instance.serverList[serverId].storageMonitorGroups[groupId];
        
        if (!group) return null;

        let totalQuantity = 0;
        let foundInMonitors = [];

        // Convert search term to lowercase for case-insensitive comparison
        const normalizedSearch = searchItem.toLowerCase();

        for (const monitorId of group.monitors) {
            if (!instance.serverList[serverId].storageMonitors[monitorId]) continue;
            
            const info = await rustplus.getEntityInfoAsync(monitorId);
            if (!(await rustplus.isResponseValid(info))) continue;

            const items = info.entityInfo.payload.items;
            for (const item of items) {
                const itemName = client.items.getName(item.itemId).toLowerCase();
                
                // Check for exact match first
                if (itemName === normalizedSearch) {
                    totalQuantity += item.quantity;
                    foundInMonitors.push({
                        monitorId,
                        name: instance.serverList[serverId].storageMonitors[monitorId].name,
                        location: instance.serverList[serverId].storageMonitors[monitorId].location,
                        quantity: item.quantity
                    });
                    continue;
                }
                
                // Check for partial match (search term is contained in item name)
                if (itemName.includes(normalizedSearch) || normalizedSearch.includes(itemName)) {
                    totalQuantity += item.quantity;
                    foundInMonitors.push({
                        monitorId,
                        name: instance.serverList[serverId].storageMonitors[monitorId].name,
                        location: instance.serverList[serverId].storageMonitors[monitorId].location,
                        quantity: item.quantity
                    });
                    continue;
                }
                
                // Check for common misspellings and variations
                const commonVariations = {
                    'gunpower': 'gunpowder',
                    'gun powder': 'gunpowder',
                    'gun powder': 'gunpowder',
                    'gun-powder': 'gunpowder',
                    'gun_powder': 'gunpowder',
                    'ammo': 'ammo.pistol',
                    'pistol ammo': 'ammo.pistol',
                    'rifle ammo': 'ammo.rifle',
                    'shotgun ammo': 'ammo.shotgun',
                    'arrow': 'arrow.wooden',
                    'wooden arrow': 'arrow.wooden',
                    'hv arrow': 'arrow.hv',
                    'high velocity arrow': 'arrow.hv',
                    'rocket': 'ammo.rocket.basic',
                    'basic rocket': 'ammo.rocket.basic',
                    'hv rocket': 'ammo.rocket.hv',
                    'high velocity rocket': 'ammo.rocket.hv',
                    'explosive': 'explosive.timed',
                    'c4': 'explosive.timed',
                    'satchel': 'explosive.satchel',
                    'satchel charge': 'explosive.satchel',
                    'beancan': 'explosive.beancan',
                    'beancan grenade': 'explosive.beancan',
                    'f1': 'grenade.f1',
                    'f1 grenade': 'grenade.f1',
                    'smoke': 'grenade.smoke',
                    'smoke grenade': 'grenade.smoke',
                    'flashbang': 'grenade.flashbang',
                    'flash bang': 'grenade.flashbang',
                    'wood': 'wood',
                    'wood log': 'wood',
                    'stone': 'stones',
                    'stones': 'stones',
                    'metal': 'metal.fragments',
                    'metal fragments': 'metal.fragments',
                    'metal frags': 'metal.fragments',
                    'frags': 'metal.fragments',
                    'cloth': 'cloth',
                    'fabric': 'cloth',
                    'leather': 'leather',
                    'charcoal': 'charcoal',
                    'coal': 'charcoal',
                    'sulfur': 'sulfur',
                    'sulfur ore': 'sulfur.ore',
                    'metal ore': 'metal.ore',
                    'stone ore': 'stones',
                    'high quality': 'metal.refined',
                    'hqm': 'metal.refined',
                    'hq': 'metal.refined',
                    'scrap': 'scrap',
                    'scrap metal': 'scrap',
                    'low grade': 'fuel',
                    'low grade fuel': 'fuel',
                    'lgf': 'fuel',
                    'fuel': 'fuel',
                    'syringe': 'syringe.medical',
                    'medical syringe': 'syringe.medical',
                    'bandage': 'bandage',
                    'bandages': 'bandage',
                    'blood': 'blood',
                    'blood bag': 'blood',
                    'water': 'water',
                    'water bottle': 'water',
                    'food': 'corn',
                    'corn': 'corn',
                    'potato': 'potato',
                    'pumpkin': 'pumpkin',
                    'apple': 'apple',
                    'mushroom': 'mushroom',
                    'berry': 'red.berry',
                    'red berry': 'red.berry',
                    'blue berry': 'blue.berry',
                    'blueberry': 'blue.berry',
                    'blueberries': 'blue.berry',
                    'redberries': 'red.berry',
                    'red berries': 'red.berry'
                };
                
                // Check if search term has a common variation
                if (commonVariations[normalizedSearch]) {
                    const correctItemName = commonVariations[normalizedSearch];
                    if (itemName.includes(correctItemName) || correctItemName.includes(itemName)) {
                        totalQuantity += item.quantity;
                        foundInMonitors.push({
                            monitorId,
                            name: instance.serverList[serverId].storageMonitors[monitorId].name,
                            location: instance.serverList[serverId].storageMonitors[monitorId].location,
                            quantity: item.quantity
                        });
                        continue;
                    }
                }
                
                // Check if item name has a common variation that matches search term
                for (const [variation, correctName] of Object.entries(commonVariations)) {
                    if (correctName === itemName && variation === normalizedSearch) {
                        totalQuantity += item.quantity;
                        foundInMonitors.push({
                            monitorId,
                            name: instance.serverList[serverId].storageMonitors[monitorId].name,
                            location: instance.serverList[serverId].storageMonitors[monitorId].location,
                            quantity: item.quantity
                        });
                        break;
                    }
                }
            }
        }

        return {
            totalQuantity,
            foundInMonitors,
            searchItem
        };
    },

    storageMonitorGroupCommandHandler: async function (rustplus, client, command) {
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;
        const instance = client.getInstance(guildId);
        const storageMonitorGroups = instance.serverList[serverId].storageMonitorGroups;
        const prefix = rustplus.generalSettings.prefix;

        // Check if the command starts with the prefix
        if (!command.startsWith(prefix)) return false;

        // Remove prefix and split the command into parts
        const commandParts = command.slice(prefix.length).trim().split(' ');
        if (commandParts.length < 2) return false;

        // Check if it's an item search command
        if (commandParts[0].toLowerCase() !== 'item') return false;

        // Get the search term (everything after 'item')
        const searchTerm = commandParts.slice(1).join(' ').trim();
        if (!searchTerm) return false;

        // Find all groups that contain storage monitors
        const groupsWithMonitors = Object.entries(storageMonitorGroups)
            .filter(([_, group]) => group.monitors.length > 0)
            .map(([id, _]) => id);

        if (groupsWithMonitors.length === 0) return false;

        // Search for the item in all groups
        let totalQuantity = 0;

        for (const groupId of groupsWithMonitors) {
            const result = await module.exports.findItemInGroup(client, rustplus, guildId, serverId, groupId, searchTerm);
            if (result && result.totalQuantity > 0) {
                totalQuantity += result.totalQuantity;
            }
        }

        // Send just the total quantity
        rustplus.sendInGameMessage(`${searchTerm}: ${totalQuantity}`);
        return true;
    }
}; 