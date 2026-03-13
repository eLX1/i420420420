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

const Constants = require('../util/constants.js');

// Global client variable that will be set by the main application
let globalClient = null;

const SUCCESS = Discord.ButtonStyle.Success;
const DANGER = Discord.ButtonStyle.Danger;
const PRIMARY = Discord.ButtonStyle.Primary;
const SECONDARY = Discord.ButtonStyle.Secondary;
const LINK = Discord.ButtonStyle.Link;

module.exports = {
    setGlobalClient: function(client) {
        globalClient = client;
    },
    
    getButton: function (options = {}) {
        const button = new Discord.ButtonBuilder();

        if (options.hasOwnProperty('customId')) button.setCustomId(options.customId);
        if (options.hasOwnProperty('label')) button.setLabel(options.label);
        if (options.hasOwnProperty('style')) button.setStyle(options.style);
        if (options.hasOwnProperty('url') && options.url !== '') button.setURL(options.url);
        if (options.hasOwnProperty('emoji')) button.setEmoji(options.emoji);
        if (options.hasOwnProperty('disabled')) button.setDisabled(options.disabled);

        return button;
    },

    getServerButtons: function (guildId, serverId, state = null) {
        const instance = globalClient.getInstance(guildId);
        const server = instance.serverList[serverId];
        const identifier = JSON.stringify({ "serverId": serverId });

        if (state === null) {
            if (instance.activeServer === serverId && globalClient.activeRustplusInstances[guildId]) {
                state = 1;
            }
            else {
                state = 0;
            }
        }

        let connectionButton = null;
        if (state === 0) {
            connectionButton = module.exports.getButton({
                customId: `ServerConnect${identifier}`,
                label: globalClient.intlGet(guildId, 'connectCap'),
                style: PRIMARY
            });
        }
        else if (state === 1) {
            connectionButton = module.exports.getButton({
                customId: `ServerDisconnect${identifier}`,
                label: globalClient.intlGet(guildId, 'disconnectCap'),
                style: DANGER
            });
        }
        else if (state === 2) {
            connectionButton = module.exports.getButton({
                customId: `ServerReconnecting${identifier}`,
                label: globalClient.intlGet(guildId, 'reconnectingCap'),
                style: DANGER
            });
        }

        const deleteUnreachableDevicesButton = module.exports.getButton({
            customId: `DeleteUnreachableDevices${identifier}`,
            label: globalClient.intlGet(guildId, 'deleteUnreachableDevicesCap'),
            style: PRIMARY
        });
        const customTimersButton = module.exports.getButton({
            customId: `CustomTimersEdit${identifier}`,
            label: globalClient.intlGet(guildId, 'customTimersCap'),
            style: PRIMARY
        });
        const trackerButton = module.exports.getButton({
            customId: `CreateTracker${identifier}`,
            label: globalClient.intlGet(guildId, 'createTrackerCap'),
            style: PRIMARY
        });
        const groupButton = module.exports.getButton({
            customId: `CreateGroup${identifier}`,
            label: globalClient.intlGet(guildId, 'createGroupCap'),
            style: PRIMARY
        });
        let linkButton = module.exports.getButton({
            label: globalClient.intlGet(guildId, 'websiteCap'),
            style: LINK,
            url: server.url
        });
        let battlemetricsButton = module.exports.getButton({
            label: globalClient.intlGet(guildId, 'battlemetricsCap'),
            style: LINK,
            url: `${Constants.BATTLEMETRICS_SERVER_URL}${server.battlemetricsId}`
        });
        let editButton = module.exports.getButton({
            customId: `ServerEdit${identifier}`,
            label: globalClient.intlGet(guildId, 'editCap'),
            style: PRIMARY
        });
        let deleteButton = module.exports.getButton({
            customId: `ServerDelete${identifier}`,
            style: SECONDARY,
            emoji: '🗑️'
        });

        if (server.battlemetricsId !== null) {
            return [
                new Discord.ActionRowBuilder().addComponents(
                    connectionButton, linkButton, battlemetricsButton, editButton, deleteButton
                ),
                new Discord.ActionRowBuilder().addComponents(
                    customTimersButton, trackerButton, groupButton
                ),
                new Discord.ActionRowBuilder().addComponents(
                    deleteUnreachableDevicesButton
                )
            ];
        }
        else {
            return [
                new Discord.ActionRowBuilder().addComponents(
                    connectionButton, linkButton, editButton, deleteButton
                ),
                new Discord.ActionRowBuilder().addComponents(
                    customTimersButton, groupButton
                ),
                new Discord.ActionRowBuilder().addComponents(
                    deleteUnreachableDevicesButton
                )
            ];
        }
    },

    getSmartSwitchButtons: function (guildId, serverId, entityId) {
        const instance = globalClient.getInstance(guildId);
        const entity = instance.serverList[serverId].switches[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: `SmartSwitch${entity.active ? 'Off' : 'On'}${identifier}`,
                label: entity.active ?
                    globalClient.intlGet(guildId, 'turnOffCap') :
                    globalClient.intlGet(guildId, 'turnOnCap'),
                style: entity.active ? DANGER : SUCCESS
            }),
            module.exports.getButton({
                customId: `SmartSwitchEdit${identifier}`,
                label: globalClient.intlGet(guildId, 'editCap'),
                style: PRIMARY
            }),
            module.exports.getButton({
                customId: `SmartSwitchDelete${identifier}`,
                style: SECONDARY,
                emoji: '🗑️'
            }));
    },

    getSmartSwitchGroupButtons: function (guildId, serverId, groupId) {
        const identifier = JSON.stringify({ "serverId": serverId, "groupId": groupId });

        return [
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    customId: `GroupTurnOn${identifier}`,
                    label: globalClient.intlGet(guildId, 'turnOnCap'),
                    style: PRIMARY
                }),
                module.exports.getButton({
                    customId: `GroupTurnOff${identifier}`,
                    label: globalClient.intlGet(guildId, 'turnOffCap'),
                    style: PRIMARY
                }),
                module.exports.getButton({
                    customId: `GroupEdit${identifier}`,
                    label: globalClient.intlGet(guildId, 'editCap'),
                    style: PRIMARY
                }),
                module.exports.getButton({
                    customId: `GroupDelete${identifier}`,
                    style: SECONDARY,
                    emoji: '🗑️'
                })),
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    customId: `GroupAddSwitch${identifier}`,
                    label: globalClient.intlGet(guildId, 'addSwitchCap'),
                    style: SUCCESS
                }),
                module.exports.getButton({
                    customId: `GroupRemoveSwitch${identifier}`,
                    label: globalClient.intlGet(guildId, 'removeSwitchCap'),
                    style: DANGER
                }))
        ];
    },

    getSmartAlarmButtons: function (guildId, serverId, entityId) {
        const instance = globalClient.getInstance(guildId);
        const entity = instance.serverList[serverId].alarms[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: `SmartAlarmEveryone${identifier}`,
                label: '@everyone',
                style: entity.everyone ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: `SmartAlarmEdit${identifier}`,
                label: globalClient.intlGet(guildId, 'editCap'),
                style: PRIMARY
            }),
            module.exports.getButton({
                customId: `SmartAlarmDelete${identifier}`,
                style: SECONDARY,
                emoji: '🗑️'
            }));
    },

    getStorageMonitorToolCupboardButtons: function (guildId, serverId, entityId) {
        const instance = globalClient.getInstance(guildId);
        const entity = instance.serverList[serverId].storageMonitors[entityId];
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: `StorageMonitorToolCupboardEveryone${identifier}`,
                label: '@everyone',
                style: entity.everyone ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: `StorageMonitorToolCupboardInGame${identifier}`,
                label: globalClient.intlGet(guildId, 'inGameCap'),
                style: entity.inGame ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: `StorageMonitorEdit${identifier}`,
                label: globalClient.intlGet(guildId, 'editCap'),
                style: PRIMARY,
            }),
            module.exports.getButton({
                customId: `StorageMonitorToolCupboardDelete${identifier}`,
                style: SECONDARY,
                emoji: '🗑️'
            }));
    },

    getStorageMonitorContainerButton: function (guildId, serverId, entityId) {
        const identifier = JSON.stringify({ "serverId": serverId, "entityId": entityId });

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: `StorageMonitorEdit${identifier}`,
                label: globalClient.intlGet(guildId, 'editCap'),
                style: PRIMARY,
            }),
            module.exports.getButton({
                customId: `StorageMonitorRecycle${identifier}`,
                label: globalClient.intlGet(guildId, 'recycleCap'),
                style: PRIMARY,
            }),
            module.exports.getButton({
                customId: `StorageMonitorContainerDelete${identifier}`,
                style: SECONDARY,
                emoji: '🗑️'
            }));
    },

    getRecycleDeleteButton: function () {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'RecycleDelete',
                style: SECONDARY,
                emoji: '🗑️'
            }));
    },

    getNotificationButtons: function (guildId, setting, discordActive, inGameActive, voiceActive) {
        const identifier = JSON.stringify({ "setting": setting });

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: `DiscordNotification${identifier}`,
                label: globalClient.intlGet(guildId, 'discordCap'),
                style: discordActive ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: `InGameNotification${identifier}`,
                label: globalClient.intlGet(guildId, 'inGameCap'),
                style: inGameActive ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: `VoiceNotification${identifier}`,
                label: globalClient.intlGet(guildId, 'voiceCap'),
                style: voiceActive ? SUCCESS : DANGER
            }));
    },

    getInGameCommandsEnabledButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'AllowInGameCommands',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getInGameTeammateNotificationsButtons: function (guildId) {
        const instance = globalClient.getInstance(guildId);

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'InGameTeammateConnection',
                label: globalClient.intlGet(guildId, 'connectionsCap'),
                style: instance.generalSettings.connectionNotify ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: 'InGameTeammateAfk',
                label: globalClient.intlGet(guildId, 'afkCap'),
                style: instance.generalSettings.afkNotify ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: 'InGameTeammateDeath',
                label: globalClient.intlGet(guildId, 'deathCap'),
                style: instance.generalSettings.deathNotify ? SUCCESS : DANGER
            }));
    },

    getFcmAlarmNotificationButtons: function (guildId, enabled, everyone) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'FcmAlarmNotification',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }),
            module.exports.getButton({
                customId: 'FcmAlarmNotificationEveryone',
                label: '@everyone',
                style: everyone ? SUCCESS : DANGER
            }));
    },

    getSmartAlarmNotifyInGameButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'SmartAlarmNotifyInGame',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getSmartSwitchNotifyInGameWhenChangedFromDiscordButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'SmartSwitchNotifyInGameWhenChangedFromDiscord',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getLeaderCommandEnabledButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'LeaderCommandEnabled',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getLeaderCommandOnlyForPairedButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'LeaderCommandOnlyForPaired',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getTrackerButtons: function (guildId, trackerId) {
        const instance = globalClient.getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ "trackerId": trackerId });

        return [
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    customId: `TrackerAddPlayer${identifier}`,
                    label: globalClient.intlGet(guildId, 'addPlayerCap'),
                    style: SUCCESS
                }),
                module.exports.getButton({
                    customId: `TrackerRemovePlayer${identifier}`,
                    label: globalClient.intlGet(guildId, 'removePlayerCap'),
                    style: DANGER
                }),
                module.exports.getButton({
                    customId: `TrackerEdit${identifier}`,
                    label: globalClient.intlGet(guildId, 'editCap'),
                    style: PRIMARY
                }),
                module.exports.getButton({
                    customId: `TrackerDelete${identifier}`,
                    style: SECONDARY,
                    emoji: '🗑️'
                })),
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    customId: `TrackerInGame${identifier}`,
                    label: globalClient.intlGet(guildId, 'inGameCap'),
                    style: tracker.inGame ? SUCCESS : DANGER
                }),
                module.exports.getButton({
                    customId: `TrackerEveryone${identifier}`,
                    label: '@everyone',
                    style: tracker.everyone ? SUCCESS : DANGER
                }),
                module.exports.getButton({
                    customId: `TrackerUpdate${identifier}`,
                    label: globalClient.intlGet(guildId, 'updateCap'),
                    style: PRIMARY
                }))
        ];
    },

    getNewsButton: function (guildId, body, validURL) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                style: LINK,
                label: globalClient.intlGet(guildId, 'linkCap'),
                url: validURL ? body.url : Constants.DEFAULT_SERVER_URL
            }));
    },

    getBotMutedInGameButton: function (guildId, isMuted) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'BotMutedInGame',
                label: isMuted ?
                    globalClient.intlGet(guildId, 'mutedCap') :
                    globalClient.intlGet(guildId, 'unmutedCap'),
                style: isMuted ? DANGER : SUCCESS
            }));
    },

    getMapWipeNotifyEveryoneButton: function (everyone) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'MapWipeNotifyEveryone',
                label: '@everyone',
                style: everyone ? SUCCESS : DANGER
            }));
    },

    getItemAvailableNotifyInGameButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'ItemAvailableNotifyInGame',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getHelpButtons: function () {
        return [
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    style: Discord.ButtonStyle.Link,
                    label: 'DEVELOPER',
                    url: 'https://github.com/alexemanuelol'
                }),
                module.exports.getButton({
                    style: Discord.ButtonStyle.Link,
                    label: 'REPOSITORY',
                    url: 'https://github.com/alexemanuelol/rustplusplus'
                })
            ),
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    style: Discord.ButtonStyle.Link,
                    label: 'DOCUMENTATION',
                    url: 'https://github.com/alexemanuelol/rustplusplus/blob/master/docs/documentation.md'
                }),
                module.exports.getButton({
                    style: Discord.ButtonStyle.Link,
                    label: 'CREDENTIALS',
                    url: 'https://github.com/alexemanuelol/rustplusplus-Credential-Application/releases/v1.4.0'
                })
            )];
    },

    getDisplayInformationBattlemetricsAllOnlinePlayersButton: function (guildId, enabled) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getButton({
                customId: 'DisplayInformationBattlemetricsAllOnlinePlayers',
                label: enabled ?
                    globalClient.intlGet(guildId, 'enabledCap') :
                    globalClient.intlGet(guildId, 'disabledCap'),
                style: enabled ? SUCCESS : DANGER
            }));
    },

    getSubscribeToChangesBattlemetricsButtons: function (guildId) {
        const instance = globalClient.getInstance(guildId);

        return [
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    customId: 'BattlemetricsServerNameChanges',
                    label: globalClient.intlGet(guildId, 'battlemetricsServerNameChangesCap'),
                    style: instance.generalSettings.battlemetricsServerNameChanges ? SUCCESS : DANGER
                }),
                module.exports.getButton({
                    customId: 'BattlemetricsTrackerNameChanges',
                    label: globalClient.intlGet(guildId, 'battlemetricsTrackerNameChangesCap'),
                    style: instance.generalSettings.battlemetricsTrackerNameChanges ? SUCCESS : DANGER
                }),
                module.exports.getButton({
                    customId: 'BattlemetricsGlobalNameChanges',
                    label: globalClient.intlGet(guildId, 'battlemetricsGlobalNameChangesCap'),
                    style: instance.generalSettings.battlemetricsGlobalNameChanges ? SUCCESS : DANGER
                })),
            new Discord.ActionRowBuilder().addComponents(
                module.exports.getButton({
                    customId: 'BattlemetricsGlobalLogin',
                    label: globalClient.intlGet(guildId, 'battlemetricsGlobalLoginCap'),
                    style: instance.generalSettings.battlemetricsGlobalLogin ? SUCCESS : DANGER
                }),
                module.exports.getButton({
                    customId: 'BattlemetricsGlobalLogout',
                    label: globalClient.intlGet(guildId, 'battlemetricsGlobalLogoutCap'),
                    style: instance.generalSettings.battlemetricsGlobalLogout ? SUCCESS : DANGER
                }))];
    },

    getStorageMonitorGroupButtons: function (groupId) {
        return [
            new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder().setCustomId(`group_view_${groupId}`).setLabel('View Group').setStyle(Discord.ButtonStyle.Primary),
                new Discord.ButtonBuilder().setCustomId(`group_edit_${groupId}`).setLabel('Edit Group').setStyle(Discord.ButtonStyle.Secondary),
                new Discord.ButtonBuilder().setCustomId(`group_delete_${groupId}`).setLabel('Delete Group').setStyle(Discord.ButtonStyle.Danger),
                new Discord.ButtonBuilder().setCustomId(`group_addmonitor_${groupId}`).setLabel('Add Monitor').setStyle(Discord.ButtonStyle.Success),
                new Discord.ButtonBuilder().setCustomId(`group_removemonitor_${groupId}`).setLabel('Remove Monitor').setStyle(Discord.ButtonStyle.Secondary)
            ),
            new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder().setCustomId(`group_search_${groupId}`).setLabel('Search Item').setStyle(Discord.ButtonStyle.Primary)
            )
        ];
    },

    getStorageMonitorGroupListButtons: function (client, guildId) {
        return new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder().setCustomId('group_create').setLabel('Create Group').setStyle(Discord.ButtonStyle.Success),
            new Discord.ButtonBuilder().setCustomId('group_list').setLabel('List Groups').setStyle(Discord.ButtonStyle.Primary),
            new Discord.ButtonBuilder().setCustomId('group_close').setLabel('Close').setStyle(Discord.ButtonStyle.Secondary)
        );
    },
}
