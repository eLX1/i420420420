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

const Express = require('express');
const Cors = require('cors');
const Path = require('path');
const Fs = require('fs').promises;
const FsSync = require('fs');

const Config = require('../../config');
const Client = require('../../index.ts');
const InstanceUtils = require('../util/instanceUtils.js');
const Timer = require('../util/timer.js');

class ApiServer {
    constructor(client) {
        this.client = client;
        this.app = Express();
        this.storageMonitorCache = {
            data: null,
            lastUpdate: null,
            updateInterval: null
        };
        this.alarmTriggersCache = {
            data: [],
            lastUpdate: null,
            updateInterval: null
        };
        this.setupMiddleware();
        this.setupRoutes();
        this.startCacheUpdateInterval();
        this.startAlarmTriggersCacheUpdate();
    }

    setupMiddleware() {
        // CORS configuration
        const corsOptions = {
            origin: Config.api.corsOrigins.includes('*') ? '*' : Config.api.corsOrigins,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type']
        };
        this.app.use(Cors(corsOptions));
        this.app.use(Express.json());
    }

    setupRoutes() {
        // GET /servers
        this.app.get('/api/servers', async (req, res) => {
            try {
                const servers = await this.getAllServers();
                res.json({ servers });
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /switches
        this.app.get('/api/switches', async (req, res) => {
            try {
                const switches = await this.getAllSwitches();
                res.json({ switches });
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /switchGroups
        this.app.get('/api/switchGroups', async (req, res) => {
            try {
                const switchGroups = await this.getAllSwitchGroups();
                res.json({ switchGroups });
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /switchGroups/:groupId
        this.app.get('/api/switchGroups/:groupId', async (req, res) => {
            try {
                const { groupId } = req.params;
                const result = await this.getSwitchGroup(groupId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // POST /switchGroups
        this.app.post('/api/switchGroups', async (req, res) => {
            try {
                const { serverId, name, command, switches } = req.body;
                const result = await this.createSwitchGroup(serverId, { name, command, switches });
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // PUT /switchGroups/:groupId
        this.app.put('/api/switchGroups/:groupId', async (req, res) => {
            try {
                const { groupId } = req.params;
                const { name, command, switches } = req.body;
                const result = await this.updateSwitchGroup(groupId, { name, command, switches });
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // DELETE /switchGroups/:groupId
        this.app.delete('/api/switchGroups/:groupId', async (req, res) => {
            try {
                const { groupId } = req.params;
                const result = await this.deleteSwitchGroup(groupId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // POST /switches/:entityId/trigger
        this.app.post('/api/switches/:entityId/trigger', async (req, res) => {
            try {
                const { entityId } = req.params;
                const result = await this.toggleSwitch(entityId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // POST /switches/:entityId
        this.app.post('/api/switches/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const { state } = req.body;
                if (typeof state !== 'boolean') {
                    return res.status(400).json({ error: 'Bad Request', message: 'Invalid state value' });
                }
                const result = await this.setSwitchState(entityId, state);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // PUT /switches/:entityId
        this.app.put('/api/switches/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const { name, command, proximity } = req.body;
                const result = await this.updateSwitch(entityId, { name, command, proximity });
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // DELETE /switches/:entityId
        this.app.delete('/api/switches/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const result = await this.deleteSwitch(entityId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /storageMonitors
        this.app.get('/api/storageMonitors', async (req, res) => {
            try {
                // Return cached data immediately, background process keeps it updated
                if (this.storageMonitorCache.data !== null) {
                    res.json({ storageMonitors: this.storageMonitorCache.data });
                } else {
                    // If no cache yet, fetch once and return
                    const storageMonitors = await this.fetchStorageMonitorsData();
                    this.storageMonitorCache.data = storageMonitors;
                    this.storageMonitorCache.lastUpdate = new Date();
                    res.json({ storageMonitors });
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // PUT /storageMonitors/:entityId
        this.app.put('/api/storageMonitors/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const { name } = req.body;
                const result = await this.updateStorageMonitor(entityId, { name });
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // DELETE /storageMonitors/:entityId
        this.app.delete('/api/storageMonitors/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const result = await this.deleteStorageMonitor(entityId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // POST /storageMonitors/:entityId/recycle
        this.app.post('/api/storageMonitors/:entityId/recycle', async (req, res) => {
            try {
                const { entityId } = req.params;
                const result = await this.getStorageMonitorRecycle(entityId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /market/search
        this.app.get('/api/market/search', async (req, res) => {
            try {
                const { order, name } = req.query;
                
                if (!order || !['all', 'buy', 'sell'].includes(order)) {
                    res.status(400).json({ error: 'Bad Request', message: 'order must be one of: all, buy, sell' });
                    return;
                }
                
                if (!name) {
                    res.status(400).json({ error: 'Bad Request', message: 'name is required' });
                    return;
                }
                
                // Find the first operational rustplus instance (same as Discord uses interaction.guildId)
                let resolvedGuildId = null;
                for (const [gId, rustplus] of Object.entries(this.client.rustplusInstances)) {
                    if (rustplus && rustplus.isOperational) {
                        resolvedGuildId = gId;
                        break;
                    }
                }
                
                if (!resolvedGuildId) {
                    res.status(503).json({ error: 'Service Unavailable', message: 'No connected Rust+ server available' });
                    return;
                }
                
                const result = await this.searchMarket(resolvedGuildId, order, name);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /servers/:serverId/activities
        this.app.get('/api/servers/:serverId/activities', async (req, res) => {
            try {
                const { serverId } = req.params;
                const activities = await this.getServerActivities(serverId);
                if (activities.error) {
                    res.status(activities.status || 404).json(activities);
                } else {
                    res.json(activities);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /alarms/triggers
        this.app.get('/api/alarms/triggers', async (req, res) => {
            try {
                const { serverId, limit } = req.query;
                // Return cached data immediately
                let triggers = this.alarmTriggersCache.data || [];
                
                // Filter by serverId if provided
                if (serverId) {
                    triggers = triggers.filter(t => t.serverId === serverId);
                }
                
                // Apply limit
                if (limit) {
                    triggers = triggers.slice(0, parseInt(limit));
                }
                
                res.json({ triggers });
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /servers/:serverId/alarms/triggers
        this.app.get('/api/servers/:serverId/alarms/triggers', async (req, res) => {
            try {
                const { serverId } = req.params;
                const { limit } = req.query;
                
                // Return cached data filtered by serverId
                let triggers = (this.alarmTriggersCache.data || []).filter(t => t.serverId === serverId);
                
                // Apply limit
                if (limit) {
                    triggers = triggers.slice(0, parseInt(limit));
                }
                
                res.json({ triggers });
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // GET /alarms
        this.app.get('/api/alarms', async (req, res) => {
            try {
                const alarms = await this.getAllAlarms();
                res.json({ alarms });
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // PUT /alarms/:entityId
        this.app.put('/api/alarms/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const { name, message, command, notificationsEnabled } = req.body;
                const result = await this.updateAlarm(entityId, { name, message, command, notificationsEnabled });
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });

        // DELETE /alarms/:entityId
        this.app.delete('/api/alarms/:entityId', async (req, res) => {
            try {
                const { entityId } = req.params;
                const result = await this.deleteAlarm(entityId);
                if (result.error) {
                    res.status(result.status || 404).json(result);
                } else {
                    res.json(result);
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error', message: error.message });
            }
        });
    }

    async readInstanceFileAsync(guildId) {
        try {
            const path = Path.join(__dirname, '..', '..', 'instances', `${guildId}.json`);
            const data = await Fs.readFile(path, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    async getAllServers() {
        const servers = [];
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Read all instances in parallel
        const instancePromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(instancePromises)).filter(i => i !== null);

        for (const { guildId, instance } of instances) {

            for (const [serverId, server] of Object.entries(instance.serverList)) {
                const rustplus = this.client.rustplusInstances[guildId];
                const isConnected = rustplus && rustplus.serverId === serverId && rustplus.isOperational;

                let serverInfo = null;
                let team = null;

                if (isConnected && rustplus.info && rustplus.team) {
                    // Server info
                    serverInfo = {
                        name: rustplus.info.name,
                        players: rustplus.info.players,
                        maxPlayers: rustplus.info.maxPlayers,
                        queuedPlayers: rustplus.info.queuedPlayers,
                        map: rustplus.info.map,
                        mapSize: rustplus.info.mapSize,
                        seed: rustplus.info.seed,
                        salt: rustplus.info.salt,
                        wipeTime: rustplus.info.wipeTime,
                        headerImage: rustplus.info.headerImage,
                        url: rustplus.info.url,
                        timeSinceWipe: rustplus.info.getTimeSinceWipe()
                    };

                    // Team info
                    const teamPlayers = rustplus.team.players.map(player => {
                        const pos = player.pos;
                        return {
                            steamId: player.steamId,
                            name: player.name,
                            x: player.x,
                            y: player.y,
                            isOnline: player.isOnline,
                            isAlive: player.isAlive,
                            teamLeader: player.teamLeader,
                            spawnTime: player.spawnTime,
                            deathTime: player.deathTime,
                            pos: pos ? {
                                location: pos.location,
                                monument: pos.monument || null,
                                string: pos.string,
                                x: pos.x,
                                y: pos.y
                            } : null,
                            aliveTime: player.getAliveTime(),
                            afkTime: player.getAfkTime()
                        };
                    });

                    team = {
                        leaderSteamId: rustplus.team.leaderSteamId,
                        teamSize: rustplus.team.teamSize,
                        allOnline: rustplus.team.allOnline,
                        allOffline: rustplus.team.allOffline,
                        players: teamPlayers
                    };
                }

                servers.push({
                    serverId: serverId,
                    guildId: guildId,
                    title: server.title,
                    serverIp: server.serverIp,
                    appPort: server.appPort,
                    description: server.description || '',
                    img: server.img || '',
                    url: server.url || '',
                    battlemetricsId: server.battlemetricsId || null,
                    connect: server.connect || '',
                    isConnected: isConnected,
                    switches: Object.keys(server.switches || {}).length,
                    alarms: Object.keys(server.alarms || {}).length,
                    storageMonitors: Object.keys(server.storageMonitors || {}).length,
                    switchGroups: Object.keys(server.switchGroups || {}).length,
                    serverInfo: serverInfo,
                    team: team
                });
            }
        }

        return servers;
    }

    async getAllSwitches() {
        const switches = [];
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Read all instances in parallel
        const instancePromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(instancePromises)).filter(i => i !== null);

        for (const { guildId, instance } of instances) {

            for (const [serverId, server] of Object.entries(instance.serverList)) {
                for (const [entityId, switchData] of Object.entries(server.switches || {})) {
                    switches.push({
                        entityId: entityId,
                        guildId: guildId,
                        serverId: serverId,
                        name: switchData.name,
                        active: switchData.active,
                        reachable: switchData.reachable,
                        command: switchData.command,
                        location: switchData.location || '',
                        x: switchData.x || null,
                        y: switchData.y || null,
                        server: switchData.server || '',
                        autoDayNightOnOff: switchData.autoDayNightOnOff || 0,
                        proximity: switchData.proximity || 0
                    });
                }
            }
        }

        return switches;
    }

    async getAllSwitchGroups() {
        const switchGroups = [];
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Read all instances in parallel
        const instancePromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(instancePromises)).filter(i => i !== null);

        for (const { guildId, instance } of instances) {
            for (const [serverId, server] of Object.entries(instance.serverList)) {
                for (const [groupId, groupData] of Object.entries(server.switchGroups || {})) {
                    // Get switch details for each switch in the group
                    const switches = (groupData.switches || []).map(switchId => {
                        const switchData = server.switches[switchId];
                        return {
                            entityId: switchId,
                            name: switchData ? switchData.name : null,
                            active: switchData ? switchData.active : false,
                            reachable: switchData ? switchData.reachable : false,
                            location: switchData ? switchData.location : null
                        };
                    });

                    switchGroups.push({
                        groupId: groupId,
                        guildId: guildId,
                        serverId: serverId,
                        name: groupData.name,
                        command: groupData.command,
                        switches: switches,
                        image: groupData.image || 'smart_switch.png',
                        messageId: groupData.messageId || null
                    });
                }
            }
        }

        return switchGroups;
    }

    async findSwitchGroupById(groupId) {
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Check instances in parallel
        const checkPromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            const instance = this.client.getInstance(guildId);
            if (!instance) {
                const instanceData = await this.readInstanceFileAsync(guildId);
                if (!instanceData) return null;
                return { guildId, instance: instanceData };
            }
            return { guildId, instance };
        });

        const instances = await Promise.all(checkPromises);
        
        for (const { guildId, instance } of instances) {
            if (!instance) continue;
            for (const [serverId, server] of Object.entries(instance.serverList || {})) {
                if (server.switchGroups && server.switchGroups[groupId]) {
                    return { guildId, serverId, group: server.switchGroups[groupId] };
                }
            }
        }

        return null;
    }

    async getSwitchGroup(groupId) {
        const found = await this.findSwitchGroupById(groupId);
        if (!found) {
            return { error: 'Not Found', message: 'Switch group not found', status: 404 };
        }

        const { guildId, serverId, group } = found;
        const instance = this.client.getInstance(guildId);
        const server = instance.serverList[serverId];

        // Get switch details for each switch in the group
        const switches = (group.switches || []).map(switchId => {
            const switchData = server.switches[switchId];
            return {
                entityId: switchId,
                name: switchData ? switchData.name : null,
                active: switchData ? switchData.active : false,
                reachable: switchData ? switchData.reachable : false,
                location: switchData ? switchData.location : null
            };
        });

        return {
            groupId: groupId,
            guildId: guildId,
            serverId: serverId,
            name: group.name,
            command: group.command,
            switches: switches,
            image: group.image || 'smart_switch.png',
            messageId: group.messageId || null
        };
    }

    async createSwitchGroup(serverId, { name, command, switches }) {
        // Find the guildId from serverId
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        let guildId = null;
        let instance = null;

        for (const file of instanceFiles) {
            const gId = file.replace('.json', '');
            const inst = this.client.getInstance(gId);
            if (inst && inst.serverList && inst.serverList[serverId]) {
                guildId = gId;
                instance = inst;
                break;
            }
        }

        if (!instance) {
            return { error: 'Not Found', message: 'Server not found', status: 404 };
        }

        const server = instance.serverList[serverId];
        if (!server) {
            return { error: 'Not Found', message: 'Server not found', status: 404 };
        }

        // Generate a unique groupId
        let groupId = null;
        for (let i = 0; i < 1000; i++) {
            const randomNumber = Math.floor(Math.random() * 1000000);
            if (!server.switchGroups || !server.switchGroups.hasOwnProperty(randomNumber)) {
                groupId = randomNumber.toString();
                break;
            }
        }

        if (!groupId) {
            return { error: 'Internal Server Error', message: 'Could not generate unique group ID', status: 500 };
        }

        // Validate switches exist
        const validSwitches = [];
        if (switches && Array.isArray(switches)) {
            for (const switchId of switches) {
                if (server.switches && server.switches[switchId]) {
                    validSwitches.push(switchId);
                }
            }
        }

        // Create the group
        if (!server.switchGroups) {
            server.switchGroups = {};
        }

        server.switchGroups[groupId] = {
            name: name || 'Group',
            command: command || groupId,
            switches: validSwitches,
            image: 'smart_switch.png',
            messageId: null
        };

        this.client.setInstance(guildId, instance);

        // Update Discord message if channel exists
        const DiscordMessages = require('../discordTools/discordMessages.js');
        if (instance.channelId && instance.channelId.switchGroups) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
        }

        return {
            groupId: groupId,
            guildId: guildId,
            serverId: serverId,
            name: server.switchGroups[groupId].name,
            command: server.switchGroups[groupId].command,
            switches: server.switchGroups[groupId].switches,
            image: server.switchGroups[groupId].image
        };
    }

    async updateSwitchGroup(groupId, updates) {
        const found = await this.findSwitchGroupById(groupId);
        if (!found) {
            return { error: 'Not Found', message: 'Switch group not found', status: 404 };
        }

        const { guildId, serverId, group } = found;
        const instance = this.client.getInstance(guildId);
        const server = instance.serverList[serverId];

        // Update name if provided
        if (updates.name !== undefined) {
            server.switchGroups[groupId].name = updates.name;
        }

        // Update command if provided
        if (updates.command !== undefined) {
            server.switchGroups[groupId].command = updates.command;
        }

        // Update switches if provided
        if (updates.switches !== undefined && Array.isArray(updates.switches)) {
            // Validate switches exist
            const validSwitches = [];
            for (const switchId of updates.switches) {
                if (server.switches && server.switches[switchId]) {
                    validSwitches.push(switchId);
                }
            }
            server.switchGroups[groupId].switches = validSwitches;
        }

        this.client.setInstance(guildId, instance);

        // Update Discord message if channel exists
        const DiscordMessages = require('../discordTools/discordMessages.js');
        if (instance.channelId && instance.channelId.switchGroups) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
        }

        return {
            groupId: groupId,
            guildId: guildId,
            serverId: serverId,
            name: server.switchGroups[groupId].name,
            command: server.switchGroups[groupId].command,
            switches: server.switchGroups[groupId].switches,
            image: server.switchGroups[groupId].image || 'smart_switch.png'
        };
    }

    async deleteSwitchGroup(groupId) {
        const found = await this.findSwitchGroupById(groupId);
        if (!found) {
            return { error: 'Not Found', message: 'Switch group not found', status: 404 };
        }

        const { guildId, serverId } = found;
        const instance = this.client.getInstance(guildId);
        const server = instance.serverList[serverId];

        // Delete Discord message if it exists
        const DiscordTools = require('../discordTools/discordTools.js');
        if (server.switchGroups[groupId].messageId && instance.channelId && instance.channelId.switchGroups) {
            try {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.switchGroups, 
                    server.switchGroups[groupId].messageId);
            } catch (error) {
                // Ignore errors when deleting message
            }
        }

        delete server.switchGroups[groupId];
        this.client.setInstance(guildId, instance);

        return { success: true };
    }

    async findDeviceByEntityId(entityId) {
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Check instances in parallel
        const checkPromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            const device = InstanceUtils.getSmartDevice(guildId, entityId);
            if (device) {
                return { ...device, guildId };
            }
            return null;
        });

        const results = await Promise.all(checkPromises);
        return results.find(r => r !== null) || null;
    }

    async toggleSwitch(entityId) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'switch') {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.switches[entityId]) {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        const rustplus = this.client.rustplusInstances[device.guildId];
        if (!rustplus || rustplus.serverId !== device.serverId || !rustplus.isOperational) {
            return { error: 'Bad Request', message: 'Server not connected', status: 400 };
        }

        const currentState = server.switches[entityId].active;
        const newState = !currentState;

        const response = await rustplus.turnSmartSwitchAsync(entityId, newState);
        if (!(await rustplus.isResponseValid(response))) {
            return { error: 'Bad Request', message: 'Failed to toggle switch', status: 400 };
        }

        server.switches[entityId].active = newState;
        server.switches[entityId].reachable = true;
        this.client.setInstance(device.guildId, instance);

        // Send in-game message if enabled
        if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
            const switchName = server.switches[entityId].name;
            const status = newState ? this.client.intlGet(device.guildId, 'onCap') : this.client.intlGet(device.guildId, 'offCap');
            const message = `Triggered ${switchName} ${status} from panel`;
            rustplus.sendInGameMessage(message);
        }

        return { success: true, state: newState };
    }

    async setSwitchState(entityId, state) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'switch') {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.switches[entityId]) {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        const rustplus = this.client.rustplusInstances[device.guildId];
        if (!rustplus || rustplus.serverId !== device.serverId || !rustplus.isOperational) {
            return { error: 'Bad Request', message: 'Server not connected', status: 400 };
        }

        const response = await rustplus.turnSmartSwitchAsync(entityId, state);
        if (!(await rustplus.isResponseValid(response))) {
            return { error: 'Bad Request', message: 'Failed to set switch state', status: 400 };
        }

        server.switches[entityId].active = state;
        server.switches[entityId].reachable = true;
        this.client.setInstance(device.guildId, instance);

        // Send in-game message if enabled
        if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
            const switchName = server.switches[entityId].name;
            const status = state ? this.client.intlGet(device.guildId, 'onCap') : this.client.intlGet(device.guildId, 'offCap');
            const message = `Triggered ${switchName} ${status} from panel`;
            rustplus.sendInGameMessage(message);
        }

        return { success: true, state: state };
    }

    async updateSwitch(entityId, updates) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'switch') {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.switches[entityId]) {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        if (updates.name !== undefined) {
            server.switches[entityId].name = updates.name;
        }
        if (updates.command !== undefined) {
            server.switches[entityId].command = updates.command;
        }
        if (updates.proximity !== undefined) {
            server.switches[entityId].proximity = updates.proximity;
        }

        this.client.setInstance(device.guildId, instance);

        return { success: true };
    }

    async deleteSwitch(entityId) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'switch') {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.switches[entityId]) {
            return { error: 'Not Found', message: 'Switch not found', status: 404 };
        }

        delete server.switches[entityId];
        this.client.setInstance(device.guildId, instance);

        return { success: true };
    }

    startCacheUpdateInterval() {
        // Update cache every 10 seconds in the background
        this.storageMonitorCache.updateInterval = setInterval(async () => {
            try {
                const storageMonitors = await this.fetchStorageMonitorsData();
                this.storageMonitorCache.data = storageMonitors;
                this.storageMonitorCache.lastUpdate = new Date();
            } catch (error) {
                // Silently fail - cache will be updated on next interval
                // Don't log to avoid spam
            }
        }, 10000); // 10 seconds

        // Initial cache population
        this.fetchStorageMonitorsData().then(storageMonitors => {
            this.storageMonitorCache.data = storageMonitors;
            this.storageMonitorCache.lastUpdate = new Date();
        }).catch(() => {
            // Ignore initial error, will retry on interval
        });
    }

    startAlarmTriggersCacheUpdate() {
        // Update alarm triggers cache every 2 seconds (faster than storage monitors for real-time feel)
        this.alarmTriggersCache.updateInterval = setInterval(async () => {
            try {
                const triggers = await this.getAlarmTriggers(null, 100); // Get last 100 triggers
                this.alarmTriggersCache.data = triggers;
                this.alarmTriggersCache.lastUpdate = new Date();
            } catch (error) {
                // Silently fail - cache will be updated on next interval
            }
        }, 2000); // 2 seconds

        // Initial cache population
        this.getAlarmTriggers(null, 100).then(triggers => {
            this.alarmTriggersCache.data = triggers;
            this.alarmTriggersCache.lastUpdate = new Date();
        }).catch(() => {
            // Ignore initial error, will retry on interval
        });
    }

    async fetchStorageMonitorsData() {
        return await this.getAllStorageMonitors();
    }

    async getAllStorageMonitors() {
        const storageMonitors = [];
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Read all instances in parallel
        const instancePromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(instancePromises)).filter(i => i !== null);

        // Collect all monitors first
        const monitorsToFetch = [];
        for (const { guildId, instance } of instances) {

            for (const [serverId, server] of Object.entries(instance.serverList)) {
                for (const [entityId, monitorData] of Object.entries(server.storageMonitors || {})) {
                    const rustplus = this.client.rustplusInstances[guildId];
                    const isConnected = rustplus && rustplus.serverId === serverId && rustplus.isOperational;

                    monitorsToFetch.push({
                        entityId,
                        guildId,
                        serverId,
                        monitorData,
                        rustplus,
                        isConnected
                    });
                }
            }
        }

        // Use the same data source as Discord: rustplus.storageMonitors[entityId]
        // If data doesn't exist, fetch it (same as Discord does)
        const client = this.client;
        
        // Fetch data for monitors that don't have cached data yet
        const fetchPromises = monitorsToFetch.map(async ({ entityId, rustplus, isConnected }) => {
            if (!isConnected || !rustplus) return null;
            
            // If data doesn't exist in rustplus.storageMonitors, fetch it
            if (!rustplus.storageMonitors || !rustplus.storageMonitors[entityId]) {
                try {
                    const info = await rustplus.getEntityInfoAsync(entityId, 2000);
                    if (await rustplus.isResponseValid(info)) {
                        const payload = info.entityInfo.payload;
                        // Store in rustplus.storageMonitors (same as Discord does)
                        if (!rustplus.storageMonitors) {
                            rustplus.storageMonitors = {};
                        }
                        rustplus.storageMonitors[entityId] = {
                            items: payload.items || [],
                            expiry: payload.protectionExpiry || 0,
                            capacity: payload.capacity || 0,
                            hasProtection: payload.hasProtection || false
                        };
                    }
                } catch (error) {
                    // Ignore errors, will try again later
                }
            }
            return null;
        });
        
        await Promise.all(fetchPromises);
        
        // Combine results using the same data Discord uses
        for (let i = 0; i < monitorsToFetch.length; i++) {
            const { entityId, guildId, serverId, monitorData, isConnected, rustplus } = monitorsToFetch[i];
            
            // Get data from rustplus.storageMonitors (same as Discord uses)
            let items = [];
            let capacity = 0;
            let expiry = 0;
            let hasProtection = false;
            
            if (isConnected && rustplus && rustplus.storageMonitors && rustplus.storageMonitors[entityId]) {
                const storageData = rustplus.storageMonitors[entityId];
                items = (storageData.items || []).map(item => {
                    const itemId = (typeof item.itemId === 'string') ? item.itemId : item.itemId.toString();
                    const itemName = client.items.getName(itemId) || '';
                    return {
                        itemId: itemId,
                        itemName: itemName,
                        quantity: item.quantity,
                        itemIsBlueprint: item.itemIsBlueprint || false
                    };
                });
                capacity = storageData.capacity || 0;
                expiry = storageData.expiry || 0;
                hasProtection = storageData.hasProtection || false;
            }
            
            storageMonitors.push({
                entityId: entityId,
                guildId: guildId,
                serverId: serverId,
                name: monitorData.name,
                reachable: monitorData.reachable,
                id: monitorData.id || entityId,
                type: monitorData.type || null,
                decaying: monitorData.decaying || false,
                upkeep: monitorData.upkeep || null,
                everyone: monitorData.everyone || false,
                inGame: monitorData.inGame !== false,
                image: monitorData.image || 'storage_monitor.png',
                location: monitorData.location || '',
                server: monitorData.server || '',
                isConnected: isConnected,
                // Use same data structure as Discord
                items: items,
                capacity: capacity,
                expiry: expiry,
                hasProtection: hasProtection
            });
        }

        return storageMonitors;
    }

    async updateStorageMonitor(entityId, updates) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'storageMonitor') {
            return { error: 'Not Found', message: 'Storage monitor not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.storageMonitors[entityId]) {
            return { error: 'Not Found', message: 'Storage monitor not found', status: 404 };
        }

        if (updates.name !== undefined) {
            server.storageMonitors[entityId].name = updates.name;
        }

        this.client.setInstance(device.guildId, instance);

        return { success: true };
    }

    async deleteStorageMonitor(entityId) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'storageMonitor') {
            return { error: 'Not Found', message: 'Storage monitor not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.storageMonitors[entityId]) {
            return { error: 'Not Found', message: 'Storage monitor not found', status: 404 };
        }

        delete server.storageMonitors[entityId];
        this.client.setInstance(device.guildId, instance);

        return { success: true };
    }

    async getStorageMonitorRecycle(entityId) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'storageMonitor') {
            return { error: 'Not Found', message: 'Storage monitor not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.storageMonitors[entityId]) {
            return { error: 'Not Found', message: 'Storage monitor not found', status: 404 };
        }

        // Get Rust+ instance
        const rustplus = this.client.rustplusInstances[device.guildId];
        if (!rustplus || rustplus.serverId !== device.serverId || !rustplus.isOperational) {
            return { error: 'Service Unavailable', message: 'Rust+ connection not available', status: 503 };
        }

        try {
            // Get current entity info from Rust+ API
            const entityInfo = await rustplus.getEntityInfoAsync(entityId);
            if (!(await rustplus.isResponseValid(entityInfo))) {
                // Update reachable status
                server.storageMonitors[entityId].reachable = false;
                this.client.setInstance(device.guildId, instance);
                return { error: 'Not Found', message: 'Storage monitor not reachable', status: 404 };
            }

            // Update reachable status
            server.storageMonitors[entityId].reachable = true;
            this.client.setInstance(device.guildId, instance);

            // Get items from entity info
            const items = entityInfo.entityInfo.payload.items || [];

            // Calculate recycle data
            const recycleData = this.client.rustlabs.getRecycleDataFromArray(items);

            // Map itemIds to item names for each recycler type
            const client = this.client;
            const formatRecycleItems = (recycleItems) => {
                return recycleItems.map(item => {
                    // Ensure itemId is a string for getName lookup
                    const itemId = (typeof item.itemId === 'string') ? item.itemId : item.itemId.toString();
                    const itemName = client.items.getName(itemId) || '';
                    return {
                        itemId: itemId,
                        itemName: itemName,
                        quantity: item.quantity,
                        itemIsBlueprint: item.itemIsBlueprint || false
                    };
                });
            };

            return {
                recycler: formatRecycleItems(recycleData.recycler || []),
                shredder: formatRecycleItems(recycleData.shredder || []),
                'safe-zone-recycler': formatRecycleItems(recycleData['safe-zone-recycler'] || [])
            };
        } catch (error) {
            return { error: 'Internal Server Error', message: error.message, status: 500 };
        }
    }

    async searchMarket(guildId, orderType, itemName) {
        // Get rustplus instance directly by guildId (same as Discord does)
        const rustplus = this.client.rustplusInstances[guildId];

        if (!rustplus) {
            return { error: 'Not Found', message: 'Guild not found', status: 404 };
        }

        if (!rustplus.isOperational) {
            return { error: 'Service Unavailable', message: 'Rust+ connection not available', status: 503 };
        }

        // Fetch fresh vending machine data
        const mapMarkersResponse = await rustplus.getMapMarkersAsync();
        if (!mapMarkersResponse || !mapMarkersResponse.mapMarkers) {
            return { error: 'Service Unavailable', message: 'Could not fetch vending machine data', status: 503 };
        }

        const MapMarkers = require('../structures/MapMarkers.js');
        rustplus.mapMarkers = new MapMarkers(mapMarkersResponse.mapMarkers, rustplus, this.client);

        // Resolve itemId from name
        const item = this.client.items.getClosestItemIdByName(itemName);
        if (item === null) {
            return { error: 'Not Found', message: `No item found with name: ${itemName}`, status: 404 };
        }
        const resolvedItemId = item;

        const resolvedItemName = this.client.items.getName(resolvedItemId);
        const results = [];

        // Search through vending machines
        for (const vendingMachine of rustplus.mapMarkers.vendingMachines) {
            if (!vendingMachine.hasOwnProperty('sellOrders')) continue;

            for (const order of vendingMachine.sellOrders) {
                if (order.amountInStock === 0) continue;

                const orderItemId = (Object.keys(this.client.items.items).includes(order.itemId.toString())) ?
                    order.itemId : null;
                const orderCurrencyId = (Object.keys(this.client.items.items)
                    .includes(order.currencyId.toString())) ? order.currencyId : null;

                const orderItemName = (orderItemId !== null) ?
                    this.client.items.getName(orderItemId) : 'unknown';
                const orderCurrencyName = (orderCurrencyId !== null) ?
                    this.client.items.getName(orderCurrencyId) : 'unknown';

                // Check if this order matches the search criteria
                const matches = (orderType === 'all' &&
                    (orderItemId === parseInt(resolvedItemId) || orderCurrencyId === parseInt(resolvedItemId))) ||
                    (orderType === 'buy' && orderCurrencyId === parseInt(resolvedItemId)) ||
                    (orderType === 'sell' && orderItemId === parseInt(resolvedItemId));

                if (matches) {
                    results.push({
                        vendingMachine: {
                            name: vendingMachine.name || 'Unnamed',
                            location: vendingMachine.location ? {
                                x: vendingMachine.location.x,
                                y: vendingMachine.location.y,
                                grid: vendingMachine.location.grid || '',
                                string: vendingMachine.location.string || ''
                            } : null,
                            shopName: vendingMachine.shopName || null
                        },
                        order: {
                            itemId: orderItemId ? orderItemId.toString() : null,
                            itemName: orderItemName,
                            quantity: order.quantity,
                            itemIsBlueprint: order.itemIsBlueprint || false,
                            currencyId: orderCurrencyId ? orderCurrencyId.toString() : null,
                            currencyName: orderCurrencyName,
                            costPerItem: order.costPerItem,
                            currencyIsBlueprint: order.currencyIsBlueprint || false,
                            amountInStock: order.amountInStock
                        }
                    });
                }
            }
        }

        return {
            itemId: resolvedItemId.toString(),
            itemName: resolvedItemName,
            orderType: orderType,
            results: results,
            count: results.length
        };
    }

    async getServerActivities(serverId) {
        // Find the guild and server
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Check instances in parallel
        const checkPromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(checkPromises)).filter(i => i !== null);

        for (const { guildId, instance } of instances) {

            if (instance.serverList[serverId]) {
                const rustplus = this.client.rustplusInstances[guildId];
                if (!rustplus || rustplus.serverId !== serverId) {
                    return {
                        serverId: serverId,
                        guildId: guildId,
                        connections: [],
                        playerConnections: {},
                        deaths: [],
                        playerDeaths: {},
                        events: {
                            all: [],
                            cargo: [],
                            heli: [],
                            small: [],
                            large: [],
                            chinook: []
                        }
                    };
                }

                // Format connections
                const connections = (rustplus.allConnections || []).map(conn => {
                    const parts = conn.split(' - ', 2);
                    return {
                        time: parts[0] || '',
                        message: parts[1] || conn
                    };
                });

                const playerConnections = {};
                for (const [steamId, conns] of Object.entries(rustplus.playerConnections || {})) {
                    playerConnections[steamId] = conns.map(conn => {
                        const parts = conn.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || conn
                        };
                    });
                }

                // Format deaths
                const deaths = (rustplus.allDeaths || []).map(death => {
                    const location = death.location ? {
                        x: death.location.x,
                        y: death.location.y,
                        grid: death.location.grid || '',
                        string: death.location.string || ''
                    } : null;

                    return {
                        time: death.time || '',
                        name: death.name || '',
                        location: location
                    };
                });

                const playerDeaths = {};
                for (const [steamId, deathList] of Object.entries(rustplus.playerDeaths || {})) {
                    playerDeaths[steamId] = deathList.map(death => {
                        const location = death.location ? {
                            x: death.location.x,
                            y: death.location.y,
                            grid: death.location.grid || '',
                            string: death.location.string || ''
                        } : null;

                        return {
                            time: death.time || '',
                            name: death.name || '',
                            location: location
                        };
                    });
                }

                // Format events
                const events = {
                    all: (rustplus.events.all || []).map(event => {
                        const parts = event.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || event
                        };
                    }),
                    cargo: (rustplus.events.cargo || []).map(event => {
                        const parts = event.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || event
                        };
                    }),
                    heli: (rustplus.events.heli || []).map(event => {
                        const parts = event.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || event
                        };
                    }),
                    small: (rustplus.events.small || []).map(event => {
                        const parts = event.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || event
                        };
                    }),
                    large: (rustplus.events.large || []).map(event => {
                        const parts = event.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || event
                        };
                    }),
                    chinook: (rustplus.events.chinook || []).map(event => {
                        const parts = event.split(' - ', 2);
                        return {
                            time: parts[0] || '',
                            message: parts[1] || event
                        };
                    })
                };

                return {
                    serverId: serverId,
                    guildId: guildId,
                    connections: connections,
                    playerConnections: playerConnections,
                    deaths: deaths,
                    playerDeaths: playerDeaths,
                    events: events
                };
            }
        }

        return { error: 'Not Found', message: 'Server not found', status: 404 };
    }

    async getAlarmTriggers(serverId, limit) {
        const triggers = [];
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Read all instances in parallel
        const instancePromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(instancePromises)).filter(i => i !== null);

        for (const { guildId, instance } of instances) {

            for (const [sId, server] of Object.entries(instance.serverList)) {
                if (serverId && sId !== serverId) continue;

                for (const [entityId, alarm] of Object.entries(server.alarms || {})) {
                    if (alarm.lastTrigger) {
                        triggers.push({
                            id: `${guildId}-${sId}-${entityId}-${alarm.lastTrigger}`,
                            entityId: entityId,
                            serverId: sId,
                            guildId: guildId,
                            name: alarm.name,
                            message: alarm.message,
                            timestamp: new Date(alarm.lastTrigger * 1000).toISOString(),
                            location: alarm.location || null,
                            type: 'alarm'
                        });
                    }
                }
            }
        }

        // Sort by timestamp (newest first)
        triggers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply limit
        if (limit) {
            return triggers.slice(0, limit);
        }

        return triggers;
    }

    async getAllAlarms() {
        const alarms = [];
        const instancesDir = Path.join(__dirname, '..', '..', 'instances');
        const instanceFiles = (await Fs.readdir(instancesDir))
            .filter(file => file.endsWith('.json'));

        // Read all instances in parallel
        const instancePromises = instanceFiles.map(async (file) => {
            const guildId = file.replace('.json', '');
            // Try to get instance from memory first, fallback to reading file
            let instance = this.client.getInstance(guildId);
            if (!instance) {
                instance = await this.readInstanceFileAsync(guildId);
                if (!instance) return null;
            }
            return { guildId, instance };
        });

        const instances = (await Promise.all(instancePromises)).filter(i => i !== null);

        for (const { guildId, instance } of instances) {

            for (const [serverId, server] of Object.entries(instance.serverList)) {
                for (const [entityId, alarmData] of Object.entries(server.alarms || {})) {
                    alarms.push({
                        entityId: entityId,
                        guildId: guildId,
                        serverId: serverId,
                        name: alarmData.name,
                        message: alarmData.message,
                        command: alarmData.command,
                        everyone: alarmData.everyone || false,
                        server: alarmData.server || '',
                        notificationsEnabled: alarmData.notificationsEnabled !== false
                    });
                }
            }
        }

        return alarms;
    }

    async updateAlarm(entityId, updates) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'alarm') {
            return { error: 'Not Found', message: 'Alarm not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.alarms[entityId]) {
            return { error: 'Not Found', message: 'Alarm not found', status: 404 };
        }

        if (updates.name !== undefined) {
            server.alarms[entityId].name = updates.name;
        }
        if (updates.message !== undefined) {
            server.alarms[entityId].message = updates.message;
        }
        if (updates.command !== undefined) {
            server.alarms[entityId].command = updates.command;
        }
        if (updates.notificationsEnabled !== undefined) {
            server.alarms[entityId].notificationsEnabled = updates.notificationsEnabled;
        }

        this.client.setInstance(device.guildId, instance);

        return { success: true };
    }

    async deleteAlarm(entityId) {
        const device = await this.findDeviceByEntityId(entityId);
        if (!device || device.type !== 'alarm') {
            return { error: 'Not Found', message: 'Alarm not found', status: 404 };
        }

        const instance = this.client.getInstance(device.guildId);
        if (!instance) {
            return { error: 'Not Found', message: 'Instance not found', status: 404 };
        }

        const server = instance.serverList[device.serverId];
        if (!server || !server.alarms[entityId]) {
            return { error: 'Not Found', message: 'Alarm not found', status: 404 };
        }

        delete server.alarms[entityId];
        this.client.setInstance(device.guildId, instance);

        return { success: true };
    }

    start() {
        if (!Config.api.enabled) {
            this.client.log(this.client.intlGet(null, 'infoCap'), 'API server is disabled');
            return;
        }

        const port = Config.api.port || 3000;
        this.app.listen(port, () => {
            this.client.log(this.client.intlGet(null, 'infoCap'), `API server started on port ${port}`);
        });
    }

    stop() {
        // Clean up cache update intervals
        if (this.storageMonitorCache.updateInterval) {
            clearInterval(this.storageMonitorCache.updateInterval);
            this.storageMonitorCache.updateInterval = null;
        }
        if (this.alarmTriggersCache.updateInterval) {
            clearInterval(this.alarmTriggersCache.updateInterval);
            this.alarmTriggersCache.updateInterval = null;
        }
    }
}

module.exports = ApiServer;

