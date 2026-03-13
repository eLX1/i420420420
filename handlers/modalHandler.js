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

const Discord = require('discord.js');

const Battlemetrics = require('../structures/Battlemetrics');
const Constants = require('../util/constants.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordButtons = require('../discordTools/discordButtons.js');
const DiscordModals = require('../discordTools/discordModals.js');
const Keywords = require('../util/keywords.js');
const Scrape = require('../util/scrape.js');
const StorageMonitorGroupHandler = require('./storageMonitorGroupHandler');

module.exports = async (client, interaction) => {
    const instance = client.getInstance(interaction.guildId);
    const guildId = interaction.guildId;

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    client.logInteraction(interaction, verifyId, 'userModal');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId.startsWith('CustomTimersEdit')) {
        const ids = JSON.parse(interaction.customId.replace('CustomTimersEdit', ''));
        const server = instance.serverList[ids.serverId];
        const cargoShipEgressTime = parseInt(interaction.fields.getTextInputValue('CargoShipEgressTime'));
        const oilRigCrateUnlockTime = parseInt(interaction.fields.getTextInputValue('OilRigCrateUnlockTime'));
        const deepSeaMinWipeCooldown = parseInt(interaction.fields.getTextInputValue('DeepSeaMinWipeCooldownTime'));
        const deepSeaMaxWipeCooldown = parseInt(interaction.fields.getTextInputValue('DeepSeaMaxWipeCooldownTime'));
        const deepSeaWipeDuration = parseInt(interaction.fields.getTextInputValue('DeepSeaWipeDurationTime'));        

        if (!server) {
            interaction.deferUpdate();
            return;
        }

        if (cargoShipEgressTime && ((cargoShipEgressTime * 1000) !== server.cargoShipEgressTimeMs)) {
            server.cargoShipEgressTimeMs = cargoShipEgressTime * 1000;
        }
        if (oilRigCrateUnlockTime && ((oilRigCrateUnlockTime * 1000) !== server.oilRigLockedCrateUnlockTimeMs)) {
            server.oilRigLockedCrateUnlockTimeMs = oilRigCrateUnlockTime * 1000;
        }
        if (deepSeaMinWipeCooldown && ((deepSeaMinWipeCooldown * 1000) !== server.deepSeaMinWipeCooldownMs)) {
            server.deepSeaMinWipeCooldownMs = deepSeaMinWipeCooldown * 1000;
        }
        if (deepSeaMaxWipeCooldown && ((deepSeaMaxWipeCooldown * 1000) !== server.deepSeaMaxWipeCooldownMs)) {
            server.deepSeaMaxWipeCooldownMs = deepSeaMaxWipeCooldown * 1000;
        }
        if (deepSeaWipeDuration && ((deepSeaWipeDuration * 1000) !== server.deepSeaWipeDurationMs)) {
            server.deepSeaWipeDurationMs = deepSeaWipeDuration * 1000;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.cargoShipEgressTimeMs}, ${server.oilRigLockedCrateUnlockTimeMs}, ${server.deepSeaMinWipeCooldownMs}, ${server.deepSeaMaxWipeCooldownMs}, ${server.deepSeaWipeDurationMs}`
        }));
    }
    else if (interaction.customId.startsWith('ServerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('ServerEdit', ''));
        const server = instance.serverList[ids.serverId];
        const battlemetricsId = interaction.fields.getTextInputValue('ServerBattlemetricsId');

        if (battlemetricsId !== server.battlemetricsId) {
            if (battlemetricsId === '') {
                server.battlemetricsId = null;
            }
            else if (client.battlemetricsInstances.hasOwnProperty(battlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[battlemetricsId];
                server.battlemetricsId = battlemetricsId;
                server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
            }
            else {
                const bmInstance = new Battlemetrics(battlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[battlemetricsId] = bmInstance;
                    server.battlemetricsId = battlemetricsId;
                    server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
                }
            }
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.battlemetricsId}`
        }));

        await DiscordMessages.sendServerMessage(interaction.guildId, ids.serverId);

        /* To force search of player name via scrape */
        client.battlemetricsIntervalCounter = 0;
    }
    else if (interaction.customId.startsWith('SmartSwitchEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartSwitchName = interaction.fields.getTextInputValue('SmartSwitchName');
        const smartSwitchCommand = interaction.fields.getTextInputValue('SmartSwitchCommand');
        let smartSwitchProximity = null;
        try {
            smartSwitchProximity = parseInt(interaction.fields.getTextInputValue('SmartSwitchProximity'));
        }
        catch (e) {
            smartSwitchProximity = null;
        }

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.switches[ids.entityId].name = smartSwitchName;

        if (smartSwitchCommand !== server.switches[ids.entityId].command &&
            !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartSwitchCommand)) {
            server.switches[ids.entityId].command = smartSwitchCommand;
        }

        if (smartSwitchProximity !== null && smartSwitchProximity >= 0) {
            server.switches[ids.entityId].proximity = smartSwitchProximity;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartSwitchName}, ${server.switches[ids.entityId].command}`
        }));

        await DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('GroupEdit')) {
        const ids = JSON.parse(interaction.customId.replace('GroupEdit', ''));
        const server = instance.serverList[ids.serverId];
        const groupName = interaction.fields.getTextInputValue('GroupName');
        const groupCommand = interaction.fields.getTextInputValue('GroupCommand');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].name = groupName;

        if (groupCommand !== server.switchGroups[ids.groupId].command &&
            !Keywords.getListOfUsedKeywords(client, interaction.guildId, ids.serverId).includes(groupCommand)) {
            server.switchGroups[ids.groupId].command = groupCommand;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${groupName}, ${server.switchGroups[ids.groupId].command}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupAddSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupAddSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupAddSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        if (!Object.keys(server.switches).includes(switchId) ||
            server.switchGroups[ids.groupId].switches.includes(switchId)) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].switches.push(switchId);
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupRemoveSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupRemoveSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].switches =
            server.switchGroups[ids.groupId].switches.filter(e => e !== switchId);
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('SmartAlarmEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartAlarmEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartAlarmName = interaction.fields.getTextInputValue('SmartAlarmName');
        const smartAlarmMessage = interaction.fields.getTextInputValue('SmartAlarmMessage');
        const smartAlarmCommand = interaction.fields.getTextInputValue('SmartAlarmCommand');

        if (!server || (server && !server.alarms.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.alarms[ids.entityId].name = smartAlarmName;
        server.alarms[ids.entityId].message = smartAlarmMessage;

        if (smartAlarmCommand !== server.alarms[ids.entityId].command &&
            !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartAlarmCommand)) {
            server.alarms[ids.entityId].command = smartAlarmCommand;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartAlarmName}, ${smartAlarmMessage}, ${server.alarms[ids.entityId].command}`
        }));

        await DiscordMessages.sendSmartAlarmMessage(interaction.guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('StorageMonitorEdit')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorEdit', ''));
        const server = instance.serverList[ids.serverId];
        const storageMonitorName = interaction.fields.getTextInputValue('StorageMonitorName');

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.storageMonitors[ids.entityId].name = storageMonitorName;
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${storageMonitorName}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(interaction.guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('TrackerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEdit', ''));
        const tracker = instance.trackers[ids.trackerId];
        const trackerName = interaction.fields.getTextInputValue('TrackerName');
        const trackerBattlemetricsId = interaction.fields.getTextInputValue('TrackerBattlemetricsId');
        const trackerClanTag = interaction.fields.getTextInputValue('TrackerClanTag');

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        tracker.name = trackerName;
        if (trackerClanTag !== tracker.clanTag) {
            tracker.clanTag = trackerClanTag;
            client.battlemetricsIntervalCounter = 0;
        }

        if (trackerBattlemetricsId !== tracker.battlemetricsId) {
            if (client.battlemetricsInstances.hasOwnProperty(trackerBattlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[trackerBattlemetricsId];
                tracker.battlemetricsId = trackerBattlemetricsId;
                tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
                tracker.img = Constants.DEFAULT_SERVER_IMG;
                tracker.title = bmInstance.server_name;
            }
            else {
                const bmInstance = new Battlemetrics(trackerBattlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[trackerBattlemetricsId] = bmInstance;
                    tracker.battlemetricsId = trackerBattlemetricsId;
                    tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
                    tracker.img = Constants.DEFAULT_SERVER_IMG;
                    tracker.title = bmInstance.server_name;
                }
            }
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${trackerName}, ${tracker.battlemetricsId}, ${tracker.clanTag}`
        }));

        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerAddPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerAddPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const id = interaction.fields.getTextInputValue('TrackerAddPlayerId');

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        const isSteamId64 = id.length === Constants.STEAMID64_LENGTH ? true : false;
        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

        if ((isSteamId64 && tracker.players.some(e => e.steamId === id)) ||
            (!isSteamId64 && tracker.players.some(e => e.playerId === id && e.steamId === null))) {
            interaction.deferUpdate();
            return;
        }

        let name = null;
        let steamId = null;
        let playerId = null;

        if (isSteamId64) {
            steamId = id;
            name = await Scrape.scrapeSteamProfileName(client, id);

            if (name && bmInstance) {
                playerId = Object.keys(bmInstance.players).find(e => bmInstance.players[e]['name'] === name);
                if (!playerId) playerId = null;
            }
        }
        else {
            playerId = id;
            if (bmInstance.players.hasOwnProperty(id)) {
                name = bmInstance.players[id]['name'];
            }
            else {
                name = '-';
            }
        }

        tracker.players.push({
            name: name,
            steamId: steamId,
            playerId: playerId
        });
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${id}`
        }));

        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemovePlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const id = interaction.fields.getTextInputValue('TrackerRemovePlayerId');

        const isSteamId64 = id.length === Constants.STEAMID64_LENGTH ? true : false;

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        if (isSteamId64) {
            tracker.players = tracker.players.filter(e => e.steamId !== id);
        }
        else {
            tracker.players = tracker.players.filter(e => e.playerId !== id || e.steamId !== null);
        }
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${id}`
        }));

        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    }
    else if (interaction.customId === 'modal_create_group') {
        const name = interaction.fields.getTextInputValue('group_name');
        const description = interaction.fields.getTextInputValue('group_description');
        
        const instance = client.getInstance(interaction.guildId);
        const serverId = instance.activeServer;
        
        if (!serverId || !instance.serverList[serverId]) {
            await interaction.reply({ content: 'No server selected.', ephemeral: true });
            return;
        }

        if (!instance.serverList[serverId].storageMonitorGroups) {
            instance.serverList[serverId].storageMonitorGroups = {};
        }

        // Generate a unique group ID
        const groupId = Date.now().toString();
        
        instance.serverList[serverId].storageMonitorGroups[groupId] = {
            id: groupId,
            name: name,
            description: description,
            monitors: []
        };
        
        client.setInstance(interaction.guildId, instance);
        
        await interaction.reply({ content: 'Storage monitor group created successfully!', ephemeral: true });
    }
    else if (interaction.customId.startsWith('modal_edit_group_')) {
        const groupId = interaction.customId.replace('modal_edit_group_', '');
        const name = interaction.fields.getTextInputValue('group_name');
        const description = interaction.fields.getTextInputValue('group_description');
        
        const instance = client.getInstance(interaction.guildId);
        const serverId = instance.activeServer;
        
        if (!serverId || !instance.serverList[serverId] || !instance.serverList[serverId].storageMonitorGroups[groupId]) {
            await interaction.reply({ content: 'Group not found.', ephemeral: true });
            return;
        }

        const group = instance.serverList[serverId].storageMonitorGroups[groupId];
        group.name = name;
        group.description = description;
        
        client.setInstance(interaction.guildId, instance);
        
        // Update the Discord message
        await DiscordMessages.sendStorageMonitorGroupMessage(interaction.guildId, serverId, groupId);
        
        await interaction.reply({ content: 'Storage monitor group updated successfully!', ephemeral: true });
    }
    else if (interaction.customId.startsWith('modal_add_monitor_')) {
        const groupId = interaction.customId.replace('modal_add_monitor_', '');
        const monitorId = interaction.fields.getTextInputValue('monitor_id');
        
        const instance = client.getInstance(interaction.guildId);
        const serverId = instance.activeServer;
        
        if (!serverId || !instance.serverList[serverId] || !instance.serverList[serverId].storageMonitorGroups[groupId]) {
            await interaction.reply({ content: 'Group not found.', ephemeral: true });
            return;
        }

        if (!instance.serverList[serverId].storageMonitors[monitorId]) {
            await interaction.reply({ content: 'Storage monitor not found.', ephemeral: true });
            return;
        }

        const group = instance.serverList[serverId].storageMonitorGroups[groupId];
        if (group.monitors.includes(monitorId)) {
            await interaction.reply({ content: 'Monitor is already in this group.', ephemeral: true });
            return;
        }

        group.monitors.push(monitorId);
        client.setInstance(interaction.guildId, instance);
        
        // Update the Discord message
        await DiscordMessages.sendStorageMonitorGroupMessage(interaction.guildId, serverId, groupId);
        
        await interaction.reply({ content: 'Monitor added to group successfully!', ephemeral: true });
    }
    else if (interaction.customId.startsWith('modal_remove_monitor_')) {
        const groupId = interaction.customId.replace('modal_remove_monitor_', '');
        const monitorId = interaction.fields.getTextInputValue('monitor_id');
        
        const instance = client.getInstance(interaction.guildId);
        const serverId = instance.activeServer;
        
        if (!serverId || !instance.serverList[serverId] || !instance.serverList[serverId].storageMonitorGroups[groupId]) {
            await interaction.reply({ content: 'Group not found.', ephemeral: true });
            return;
        }

        const group = instance.serverList[serverId].storageMonitorGroups[groupId];
        const monitorIndex = group.monitors.indexOf(monitorId);
        
        if (monitorIndex === -1) {
            await interaction.reply({ content: 'Monitor is not in this group.', ephemeral: true });
            return;
        }

        group.monitors.splice(monitorIndex, 1);
        client.setInstance(interaction.guildId, instance);
        
        // Update the Discord message
        await DiscordMessages.sendStorageMonitorGroupMessage(interaction.guildId, serverId, groupId);
        
        await interaction.reply({ content: 'Monitor removed from group successfully!', ephemeral: true });
    }

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userModalInteractionSuccess', {
        id: `${verifyId}`
    }));

    interaction.deferUpdate();
}