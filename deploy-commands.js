const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Komut dosyalarını oku
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Komutları topla
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[UYARI] ${filePath} komut dosyasında gerekli "data" veya "execute" özelliği eksik`);
    }
}

// REST örneği oluştur
const rest = new REST().setToken(token);

// Komutları yükle
(async () => {
    try {
        console.log(`${commands.length} komut yükleniyor...`);

        // Global komutlar için
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        // Tek sunucu için komutlar (daha hızlı güncellenir, test için)
        // Yorum satırını kaldırıp yukarıdaki global komutu yoruma alabilirsiniz
        /*
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        */

        console.log(`${data.length} komut başarıyla yüklendi!`);
    } catch (error) {
        console.error(error);
    }
})();