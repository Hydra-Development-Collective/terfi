const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Veri dosyasının yolu
const dataPath = path.join(__dirname, '../data/promotions.json');

// Veri dosyasını kontrol etme ve oluşturma fonksiyonu
function checkDataFile() {
    try {
        if (!fs.existsSync(path.dirname(dataPath))) {
            fs.mkdirSync(path.dirname(dataPath), { recursive: true });
            console.log('Data klasörü oluşturuldu.');
        }

        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({
                promotions: [],
                roles: [
                    // Burada terfi rolleri tanımlanacak
                    // örnek: { id: "ROL_ID_1", level: 1, name: "Acemi" },
                    // örnek: { id: "ROL_ID_2", level: 2, name: "Tecrübeli" },
                    // Rol bilgilerini buraya ekleyiniz
                ]
            }, null, 2));
            console.log('Promotions veri dosyası oluşturuldu.');
        }
    } catch (error) {
        console.error('Veri dosyası oluşturulurken hata:', error);
    }
}

// Verileri kaydetme fonksiyonu
function saveData(data) {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Veriler kaydedilirken hata:', error);
        throw new Error('Veriler kaydedilemedi.');
    }
}

// Verileri yükleme fonksiyonu
function loadData() {
    try {
        checkDataFile();
        const rawData = fs.readFileSync(dataPath);
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Veriler yüklenirken hata:', error);
        return { promotions: [], roles: [] };
    }
}

// Bir sonraki rolü bulma fonksiyonu
function findNextRole(currentRole, roles) {
    // Eğer kullanıcının hiç rolü yoksa, en düşük seviyeli rolü döndür
    if (!currentRole) {
        return roles.sort((a, b) => a.level - b.level)[0];
    }

    // Kullanıcının mevcut rol seviyesi
    const currentLevel = roles.find(role => role.id === currentRole.id)?.level || 0;
    
    // Bir sonraki seviye rolünü bul
    return roles.find(role => role.level === currentLevel + 1);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('terfi')
        .setDescription('Belirtilen kullanıcıyı terfi ettirir.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Terfi ettirilecek kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    async execute(interaction) {
        try {
            // Komutu kullanana bekleme mesajı gönder
            await interaction.deferReply();
            
            // Veri dosyasını yükle
            const data = loadData();
            
            // Rol listesi kontrol et
            if (!data.roles || data.roles.length === 0) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Hata')
                            .setDescription('Terfi rolleri henüz tanımlanmamış. Lütfen veri dosyasını kontrol edin.')
                            .setFooter({ text: 'Terfi Sistemi' })
                            .setTimestamp()
                    ]
                });
            }
            
            // Hedef kullanıcıyı al
            const targetUser = interaction.options.getUser('kullanici');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Hata')
                            .setDescription('Belirtilen kullanıcı sunucuda bulunamadı.')
                            .setFooter({ text: 'Terfi Sistemi' })
                            .setTimestamp()
                    ]
                });
            }
            
            // Komutu kullanan kişinin yetkisini kontrol et
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Yetersiz Yetki')
                            .setDescription('Bu komutu kullanmak için "Rolleri Yönet" yetkisine sahip olmalısınız.')
                            .setFooter({ text: 'Terfi Sistemi' })
                            .setTimestamp()
                    ]
                });
            }
            
            // Botun yetkisini kontrol et
            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Bot Yetkisi Yetersiz')
                            .setDescription('Terfi işlemi yapmak için botun "Rolleri Yönet" yetkisine sahip olması gerekiyor.')
                            .setFooter({ text: 'Terfi Sistemi' })
                            .setTimestamp()
                    ]
                });
            }
            
            // Kullanıcının mevcut rollerini kontrol et
            const userRoles = targetMember.roles.cache;
            
            // Terfi listesindeki rolleri kontrol et ve en yüksek seviyeli rolü bul
            let currentRole = null;
            let highestRoleLevel = -1;
            
            for (const role of data.roles) {
                if (userRoles.has(role.id) && role.level > highestRoleLevel) {
                    currentRole = role;
                    highestRoleLevel = role.level;
                }
            }
            
            // Bir sonraki rolü bul
            const nextRole = findNextRole(currentRole, data.roles);
            
            if (!nextRole) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('⚠️ Terfi Mümkün Değil')
                            .setDescription(`${targetUser.toString()} zaten en yüksek seviyede veya terfi edebileceği bir rol bulunmuyor.`)
                            .setFooter({ text: 'Terfi Sistemi' })
                            .setTimestamp()
                    ]
                });
            }
            
            // Yeni rolü ekle ve eski rolü çıkar
            try {
                // Bir sonraki rolü ekle
                await targetMember.roles.add(nextRole.id);
                
                // Mevcut rolü varsa kaldır
                if (currentRole) {
                    await targetMember.roles.remove(currentRole.id);
                }
                
                // Terfi kaydını tut
                data.promotions.push({
                    userId: targetUser.id,
                    username: targetUser.username,
                    promotedBy: interaction.user.id,
                    promotedByUsername: interaction.user.username,
                    oldRole: currentRole ? currentRole.id : null,
                    newRole: nextRole.id,
                    timestamp: new Date().toISOString()
                });
                
                // Veriyi kaydet
                saveData(data);
                
                // Başarılı mesajı gönder
                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🎉 Terfi İşlemi Başarılı')
                    .setDescription(`${targetUser.toString()} başarıyla terfi ettirildi!`)
                    .addFields(
                        { name: 'Kullanıcı', value: targetUser.toString(), inline: true },
                        { name: 'Önceki Rol', value: currentRole ? `<@&${currentRole.id}>` : 'Yok', inline: true },
                        { name: 'Yeni Rol', value: `<@&${nextRole.id}>`, inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Terfi Sistemi' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [successEmbed] });
                
                // Kullanıcıya özel mesaj göndermeyi dene
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('🎉 Terfi Aldınız!')
                        .setDescription(`**${interaction.guild.name}** sunucusunda terfi aldınız!`)
                        .addFields(
                            { name: '❌Önceki Rol', value: currentRole ? `<@&${currentRole.id}>` : 'Yok', inline: true },
                            { name: '✔Yeni Rol', value: `<@&${nextRole.id}>`, inline: true }
                        )
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setFooter({ text: `Terfi Eden: ${interaction.user.tag}` })
                        .setTimestamp();
                    
                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log(`${targetUser.tag} kullanıcısına DM gönderilemedi: ${error.message}`);
                }
                
            } catch (error) {
                console.error('Rol işlemi sırasında hata:', error);
                
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Rol İşlemi Hatası')
                            .setDescription('Roller güncellenirken bir hata oluştu. Bot yetkileri ve rol hiyerarşisini kontrol edin.')
                            .setFooter({ text: 'Terfi Sistemi' })
                            .setTimestamp()
                    ]
                });
            }
            
        } catch (error) {
            console.error('Terfi komutu çalıştırılırken hata:', error);
            
            // Eğer zaten cevap verilmişse editle, verilmemişse yeni cevap gönder
            const replyMethod = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
            
            await interaction[replyMethod]({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ Hata')
                        .setDescription('Terfi işlemi sırasında beklenmeyen bir hata oluştu.')
                        .setFooter({ text: 'Terfi Sistemi' })
                        .setTimestamp()
                ]
            });
        }
    }
};
