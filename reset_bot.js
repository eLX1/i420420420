/*
    Bot Total Reset Script
    This script resets the bot instance file to default values
*/

const Fs = require('fs');
const Path = require('path');

// Guild ID - Change this to your Discord server ID
const GUILD_ID = '1343287323915325462';

// Default instance template
const defaultInstance = {
    firstTime: true,
    role: null,
    generalSettings: {
        language: "en",
        voiceGender: "male",
        prefix: "!",
        muteInGameBotMessages: false,
        trademark: "rustplusplus",
        inGameCommandsEnabled: true,
        fcmAlarmNotificationEnabled: false,
        fcmAlarmNotificationEveryone: false,
        smartAlarmNotifyInGame: true,
        smartSwitchNotifyInGameWhenChangedFromDiscord: true,
        leaderCommandEnabled: true,
        leaderCommandOnlyForPaired: false,
        commandDelay: 0,
        connectionNotify: false,
        afkNotify: false,
        deathNotify: false,
        mapWipeNotifyEveryone: false,
        itemAvailableInVendingMachineNotifyInGame: true,
        displayInformationBattlemetricsAllOnlinePlayers: false,
        battlemetricsServerNameChanges: true,
        battlemetricsTrackerNameChanges: true,
        battlemetricsGlobalNameChanges: false,
        battlemetricsGlobalLogin: false,
        battlemetricsGlobalLogout: false
    },
    notificationSettings: {
        cargoShipDetectedSetting: {
            image: "cargoship_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        cargoShipLeftSetting: {
            image: "cargoship_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        cargoShipEgressSetting: {
            image: "cargoship_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        cargoShipDockingAtHarborSetting: {
            image: "cargoship_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        patrolHelicopterDetectedSetting: {
            image: "patrol_helicopter_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        patrolHelicopterLeftSetting: {
            image: "patrol_helicopter_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        patrolHelicopterDestroyedSetting: {
            image: "patrol_helicopter_downed_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        lockedCrateOilRigUnlockedSetting: {
            image: "locked_crate_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        heavyScientistCalledSetting: {
            image: "oil_rig_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        chinook47DetectedSetting: {
            image: "chinook_47_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        travelingVendorDetectedSetting: {
            image: "traveling_vendor_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        travelingVendorHaltedSetting: {
            image: "traveling_vendor_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        travelingVendorLeftSetting: {
            image: "traveling_vendor_logo.png",
            discord: true,
            inGame: false,
            voice: true
        },
        vendingMachineDetectedSetting: {
            image: "vending_machine_logo.png",
            discord: true,
            inGame: false,
            voice: true
        }
    },
    channelId: {
        category: null,
        information: null,
        servers: null,
        settings: null,
        commands: null,
        events: null,
        teamchat: null,
        switches: null,
        switchGroups: null,
        alarms: null,
        storageMonitors: null,
        activity: null,
        trackers: null
    },
    informationMessageId: {
        map: null,
        server: null,
        event: null,
        team: null,
        battlemetricsPlayers: null
    },
    activeServer: null,
    serverList: {},
    serverListLite: {},
    trackers: {},
    marketSubscriptionList: {
        all: [],
        buy: [],
        sell: []
    },
    teamChatColors: {},
    blacklist: {
        discordIds: [],
        steamIds: []
    },
    aliases: [],
    storageMonitorGroups: []
};

// Function to reset instance file
function resetInstanceFile() {
    const instancePath = Path.join(__dirname, 'instances', `${GUILD_ID}.json`);
    
    console.log(`Resetting instance file for guild: ${GUILD_ID}`);
    
    // Backup existing file if it exists
    if (Fs.existsSync(instancePath)) {
        const backupPath = Path.join(__dirname, 'instances', `${GUILD_ID}.json.backup`);
        Fs.copyFileSync(instancePath, backupPath);
        console.log(`Backup created: ${backupPath}`);
    }
    
    // Write default instance
    Fs.writeFileSync(instancePath, JSON.stringify(defaultInstance, null, 2));
    console.log(`Instance file reset successfully: ${instancePath}`);
}

// Function to reset credentials file (optional - removes all credentials)
function resetCredentialsFile() {
    const credentialsPath = Path.join(__dirname, 'credentials', `${GUILD_ID}.json`);
    
    console.log(`Resetting credentials file for guild: ${GUILD_ID}`);
    
    // Backup existing file if it exists
    if (Fs.existsSync(credentialsPath)) {
        const backupPath = Path.join(__dirname, 'credentials', `${GUILD_ID}.json.backup`);
        Fs.copyFileSync(credentialsPath, backupPath);
        console.log(`Backup created: ${backupPath}`);
    }
    
    // Write default credentials (empty hoster)
    const defaultCredentials = { hoster: null };
    Fs.writeFileSync(credentialsPath, JSON.stringify(defaultCredentials, null, 2));
    console.log(`Credentials file reset successfully: ${credentialsPath}`);
    console.log(`WARNING: You will need to re-add your credentials using /credentials add command`);
}

// Function to delete map files
function deleteMapFiles() {
    const mapsDir = Path.join(__dirname, 'maps');
    const mapFiles = [
        `${GUILD_ID}_map_clean.png`,
        `${GUILD_ID}_map_full.png`
    ];
    
    console.log(`Deleting map files for guild: ${GUILD_ID}`);
    
    mapFiles.forEach(file => {
        const filePath = Path.join(mapsDir, file);
        if (Fs.existsSync(filePath)) {
            Fs.unlinkSync(filePath);
            console.log(`Deleted: ${file}`);
        }
    });
}

// Main execution
console.log('========================================');
console.log('Bot Total Reset Script');
console.log('========================================\n');

// Check command line arguments
const args = process.argv.slice(2);
const resetCredentials = args.includes('--reset-credentials');
const resetMaps = args.includes('--reset-maps');

// Reset instance file
resetInstanceFile();

// Optionally reset credentials
if (resetCredentials) {
    resetCredentialsFile();
} else {
    console.log('\nSkipping credentials reset (use --reset-credentials to reset)');
}

// Optionally delete map files
if (resetMaps) {
    deleteMapFiles();
} else {
    console.log('\nSkipping map files deletion (use --reset-maps to delete)');
}

console.log('\n========================================');
console.log('Reset Complete!');
console.log('========================================');
console.log('\nNext steps:');
console.log('1. Restart your bot');
console.log('2. In Discord, run: /reset discord');
if (resetCredentials) {
    console.log('3. Re-add your credentials using: /credentials add');
}
console.log('\n');

