const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { token } = require('./config.json');

// Yeni istemci oluştur
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// Komut koleksiyonu oluştur
client.commands = new Collection();

// Komut dosyalarını yükle
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Komut data ve execute özellikleri kontrol edilir
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[KOMUT] ${command.data.name} komutu yüklendi.`);
    } else {
        console.warn(`[UYARI] ${filePath} komut dosyasında 'data' veya 'execute' özelliği eksik.`);
    }
}

// Hazır olduğunda tetiklenir
client.once(Events.ClientReady, () => {
    console.log(`[BOT] ${client.user.tag} olarak giriş yapıldı!`);
    console.log(`[BOT] ${client.guilds.cache.size} sunucuda aktif.`);
    console.log('[BOT] Terfi sistemi hazır.');
    
    // Veri klasörünün varlığını kontrol et
    const dataPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath);
        console.log('[SISTEM] Data klasörü oluşturuldu.');
    }
});

// Slash komut işleyicisi
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    
    if (!command) {
        console.error(`[HATA] ${interaction.commandName} komutu bulunamadı.`);
        return;
    }
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[HATA] ${interaction.commandName} komutu yürütülürken hata oluştu:`, error);
        
        // Eğer zaten cevap verilmişse editReply kullan, verilmemişse reply kullan
        const replyMethod = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
        
        try {
            await interaction[replyMethod]({
                content: 'Bu komutu çalıştırırken bir hata oluştu!',
                ephemeral: true 
            });
        } catch (e) {
            console.error('[HATA] Hata mesajı gönderilemedi:', e);
        }
    }
});

// Hata yakalama
process.on('unhandledRejection', error => {
    console.error('[KRITIK-HATA] İşlenmemiş promise reddi:', error);
});

process.on('uncaughtException', error => {
    console.error('[KRITIK-HATA] İşlenmemiş istisna:', error);
});

// Bot'u başlat
client.login(token).catch(error => {
    console.error('[HATA] Bot girişi başarısız:', error);
});