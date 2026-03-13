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

const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const InstanceUtils = require('../util/instanceUtils.js');
const DiscordButtons = require('../discordTools/discordButtons.js');
const DiscordTools = require('../discordTools/discordTools.js');

module.exports = {
	name: 'storagemonitor',

	getData(client, guildId) {
		return new Builder.SlashCommandBuilder()
			.setName('storagemonitor')
			.setDescription(client.intlGet(guildId, 'commandsStorageMonitorDesc'))
			.addSubcommand(subcommand => subcommand
				.setName('edit')
				.setDescription(client.intlGet(guildId, 'commandsStorageMonitorEditDesc'))
				.addStringOption(option => option
					.setName('id')
					.setDescription(client.intlGet(guildId, 'commandsStorageMonitorEditIdDesc'))
					.setRequired(true))
				.addStringOption(option => option
					.setName('image')
					.setDescription(client.intlGet(guildId, 'commandsStorageMonitorEditImageDesc'))
					.setRequired(false)))
			.addSubcommand(subcommand => subcommand
				.setName('group-create')
				.setDescription('Create a new storage monitor group')
				.addStringOption(option => option
					.setName('name')
					.setDescription('Group name')
					.setRequired(true))
				.addStringOption(option => option
					.setName('description')
					.setDescription('Group description')
					.setRequired(false)))
			.addSubcommand(subcommand => subcommand
				.setName('group-delete')
				.setDescription('Delete a storage monitor group')
				.addStringOption(option => option
					.setName('name')
					.setDescription('Group name')
					.setRequired(true)));
	},

	async execute(client, interaction) {
		const guildId = interaction.guildId;
		const instance = client.getInstance(guildId);
		const rustplus = client.rustplusInstances[guildId];

		const verifyId = Math.floor(100000 + Math.random() * 900000);
		client.logInteraction(interaction, verifyId, 'slashCommand');

		if (!await client.validatePermissions(interaction)) return;
		await interaction.deferReply({ ephemeral: true });

		switch (interaction.options.getSubcommand()) {
			case 'edit': {
				const entityId = interaction.options.getString('id');
				const image = interaction.options.getString('image');

				const device = InstanceUtils.getSmartDevice(guildId, entityId);
				if (device === null) {
					const str = client.intlGet(guildId, 'invalidId', { id: entityId });
					await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
					client.log(client.intlGet(null, 'warningCap'), str);
					return;
				}

				const entity = instance.serverList[device.serverId].storageMonitors[entityId];

				if (image !== null) {
					instance.serverList[device.serverId].storageMonitors[entityId].image = `${image}.png`;
				}
				client.setInstance(guildId, instance);

				client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
					id: `${verifyId}`,
					value: `edit, ${entityId}, ${image}.png`
				}));

				if (rustplus && rustplus.serverId === device.serverId) {
					await DiscordMessages.sendStorageMonitorMessage(guildId, device.serverId, entityId);
				}

				const str = client.intlGet(guildId, 'storageMonitorEditSuccess', { name: entity.name });
				await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str,
					instance.serverList[device.serverId].title));
				client.log(client.intlGet(null, 'infoCap'), str);
			} break;

			case 'group-create': {
				const name = interaction.options.getString('name');
				const description = interaction.options.getString('description');

				// Generate a unique group ID
				const groupId = Date.now().toString();
				
				const group = {
					id: groupId,
					name: name,
					description: description || '',
					monitors: [],
					messageId: null,
					image: 'storage_monitor.png'
				};

				// Initialize storage monitor groups if they don't exist
				if (!instance.serverList[instance.activeServer].storageMonitorGroups) {
					instance.serverList[instance.activeServer].storageMonitorGroups = {};
				}

				instance.serverList[instance.activeServer].storageMonitorGroups[groupId] = group;
				client.setInstance(guildId, instance);

				// Send the group message to Discord
				await DiscordMessages.sendStorageMonitorGroupMessage(guildId, instance.activeServer, groupId);

				const str = client.intlGet(guildId, 'storageMonitorGroupCreateSuccess', { name: name });
				await interaction.reply({
					embeds: [DiscordEmbeds.getActionInfoEmbed(0, str, instance.serverList[instance.activeServer].title)],
					ephemeral: true
				});
				client.log(client.intlGet(null, 'infoCap'), str);
			} break;

			case 'group-delete': {
				const name = interaction.options.getString('name');

				// Find the group by name
				const groups = instance.serverList[instance.activeServer].storageMonitorGroups;
				const groupId = Object.keys(groups).find(id => groups[id].name === name);

				if (!groupId) {
					const str = client.intlGet(guildId, 'invalidGroup', { group: name });
					await interaction.reply({
						embeds: [DiscordEmbeds.getActionInfoEmbed(1, str)],
						ephemeral: true
					});
					return;
				}

				const group = groups[groupId];

				// Delete the Discord message if it exists
				if (group.messageId) {
					await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, group.messageId);
				}

				delete instance.serverList[instance.activeServer].storageMonitorGroups[groupId];
				client.setInstance(guildId, instance);

				const str = client.intlGet(guildId, 'storageMonitorGroupDeleteSuccess', { name: name });
				await interaction.reply({
					embeds: [DiscordEmbeds.getActionInfoEmbed(0, str, instance.serverList[instance.activeServer].title)],
					ephemeral: true
				});
				client.log(client.intlGet(null, 'infoCap'), str);
			} break;

			default: {
			} break;
		}
	},
};
