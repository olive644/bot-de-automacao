// ============================================
// Identidade visual da conta conectada ao WhatsApp
// ============================================

const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config');
const logger = require('../utils/logger');

async function configureBotProfile(client) {
  if (!config.applyBotProfile) {
    logger.info('[Perfil] Atualização automática desativada.');
    return;
  }

  try {
    const renamed = await client.setDisplayName(config.botName);
    if (renamed) {
      logger.info(`[Perfil] Nome configurado como "${config.botName}".`);
    } else {
      logger.warn('[Perfil] O WhatsApp não permitiu alterar o nome desta conta.');
    }
  } catch (error) {
    logger.warn('[Perfil] Não foi possível alterar o nome:', error.message);
  }

  if (!fs.existsSync(config.botProfileImage)) {
    logger.warn(`[Perfil] Imagem não encontrada: ${config.botProfileImage}`);
    return;
  }

  try {
    const media = MessageMedia.fromFilePath(config.botProfileImage);
    const updated = await client.setProfilePicture(media);
    if (updated) {
      logger.info('[Perfil] Foto do Oli - Bot configurada.');
    } else {
      logger.warn('[Perfil] O WhatsApp não permitiu alterar a foto desta conta.');
    }
  } catch (error) {
    logger.warn('[Perfil] Não foi possível alterar a foto:', error.message);
  }
}

module.exports = { configureBotProfile };
