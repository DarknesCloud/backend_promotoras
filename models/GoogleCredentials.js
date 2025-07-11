const mongoose = require('mongoose');

const googleCredentialsSchema = new mongoose.Schema(
  {
    // Identificador único para las credenciales (puede ser 'system' para credenciales del sistema)
    identifier: {
      type: String,
      required: true,
      unique: true,
      default: 'system'
    },
    
    // Tokens de Google OAuth2
    access_token: {
      type: String,
      required: true
    },
    
    refresh_token: {
      type: String,
      required: true
    },
    
    token_type: {
      type: String,
      default: 'Bearer'
    },
    
    scope: {
      type: String,
      required: true
    },
    
    expiry_date: {
      type: Number,
      required: true
    },
    
    // Metadatos adicionales
    created_by: {
      type: String,
      default: 'admin'
    },
    
    last_used: {
      type: Date,
      default: Date.now
    },
    
    is_active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Método estático para obtener las credenciales activas del sistema
googleCredentialsSchema.statics.getSystemCredentials = async function() {
  return await this.findOne({ 
    identifier: 'system', 
    is_active: true 
  });
};

// Método estático para actualizar o crear credenciales del sistema
googleCredentialsSchema.statics.updateSystemCredentials = async function(credentials) {
  const existingCredentials = await this.findOne({ identifier: 'system' });
  
  if (existingCredentials) {
    // Actualizar credenciales existentes
    existingCredentials.access_token = credentials.access_token;
    existingCredentials.refresh_token = credentials.refresh_token;
    existingCredentials.token_type = credentials.token_type || 'Bearer';
    existingCredentials.scope = credentials.scope;
    existingCredentials.expiry_date = credentials.expiry_date;
    existingCredentials.last_used = new Date();
    existingCredentials.is_active = true;
    
    return await existingCredentials.save();
  } else {
    // Crear nuevas credenciales
    return await this.create({
      identifier: 'system',
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      token_type: credentials.token_type || 'Bearer',
      scope: credentials.scope,
      expiry_date: credentials.expiry_date,
      created_by: 'admin',
      is_active: true
    });
  }
};

// Método para verificar si el token está expirado
googleCredentialsSchema.methods.isExpired = function() {
  return this.expiry_date <= Date.now();
};

// Método para marcar como usado
googleCredentialsSchema.methods.markAsUsed = async function() {
  this.last_used = new Date();
  return await this.save();
};

module.exports = mongoose.model('GoogleCredentials', googleCredentialsSchema);

