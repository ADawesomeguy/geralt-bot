require('dotenv').config()

const axios = require('axios');
const mongoose = require('mongoose');
const captcha = require('trek-captcha');
const Discord = require('discord.js');
const client = new Discord.Client({
  intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES", "DIRECT_MESSAGE_REACTIONS"],
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
});

const dbGuild = require('./models/guild.js');

const slashcommandsjson = require('./config/slashcommands.json');
const geralt = require('./config/geralt.json');

const combatArray = geralt.combat;
const hmmArray = geralt.hmm;
const fuckArray = geralt.fuck;
const quoteArray = geralt.quotes;

client.on('ready', async () => {
  mongoose.connect(process.env.MONGODB_URI, { useUnifiedTopology: true, useNewUrlParser: true })
  .then(() => {
    console.log("Connected to DB!");
  })
  .catch(console.error);

  client.guilds.cache.forEach(async guild => {
    const guildExists = await dbGuild.find({ guildId: guild.id });
    if (!guildExists.length) {
      const newGuild = new dbGuild({
        guildId: guild.id
      })
      await newGuild.save();
    }
  })

  console.log(`Logged in as ${client.user.tag}!`);
  if (process.env.TESTING) {
    client.guilds.cache.get(process.env.TESTING_GUILD).commands.set(slashcommandsjson);
  } else {
    client.application.commands.set(slashcommandsjson);
  }
});

client.on("guildCreate", async guild => {
  const guildExists = await dbGuild.find({ guildId: guild.id });
  if (!guildExists.length) {
    const newGuild = new dbGuild({
      guildId: guild.id
    })
    await newGuild.save();
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    switch (interaction.commandName) {
      case 'combat':
        combat(interaction);
        break;
      case 'hmm':
        hmm(interaction);
        break;
      case 'fuck':
        fuck(interaction);
        break;
      case 'verify':
        verify(interaction);
        break;
      case 'verificationrole':
        verificationRole(interaction);
        break;
      case 'w3api':
        w3api(interaction);
        break;
      case 'quote':
        quote(interaction);
        break;
    }
  } else if (interaction.isButton()) {
    switch (interaction.customId) {
      case "w3-characters":
        w3characters(interaction);
        break;
      case "w3-creatures":
        w3creatures(interaction);
        break;
      /*case "w3-quests":
        w3quests(interaction);
        break;*/
    }
  }
});

async function combat(interaction) {
  interaction.reply(`> *${combatArray[Math.floor(Math.random()*combatArray.length)]}*`);
}

async function hmm(interaction) {
  interaction.reply(`${hmmArray[Math.floor(Math.random()*hmmArray.length)]}`)
}

async function fuck(interaction) {
  interaction.reply(`${fuckArray[Math.floor(Math.random()*fuckArray.length)]}`)
}

async function verify(interaction) {
  const verificationRoleId = await dbGuild.findOne({ guildId: interaction.guild.id });
  if (!verificationRoleId.verificationRoleId) return interaction.reply("No verification role defined");
  if (!interaction.guild) return interaction.reply("This action must be performed in a guild!");
  const { token, buffer } = await captcha();
  interaction.reply({
    files: [{
      attachment: buffer,
      name: 'captcha.jpg'
    }]
  })
  .then(() => {
    const filter = m => m.author.id === interaction.user.id;
    interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 15000,
      errors: ['time']
    })
    .then(collected => {
      verificationMessage = collected.first();
      if (verificationMessage.content === token) {
        verificationMessage.reply("Correct!");
        interaction.member.roles.add(verificationRoleId.verificationRoleId);
      } else {
        verificationMessage.reply("Incorrect.");
      }
    })
    .catch(collected => {
      interaction.editReply("This verification message has timed out.");
    });
  })
}

async function verificationRole(interaction) {
  if (!interaction.member.permissions.has('ADMINISTRATOR')) return interaction.reply("You do not have administrator permissions.");
  const roleId = interaction.options.get('role').value;
  const guildDoc = await dbGuild.findOne({ guildId: interaction.guild.id});
  guildDoc.verificationRoleId = roleId;
  await guildDoc.save(async err => {
    if (err) return interaction.reply("Unable to save verification role.");
    interaction.reply("Verification role saved!");
  });
}

async function w3api(interaction) {
  const row = new Discord.MessageActionRow()
			.addComponents(
				new Discord.MessageButton()
					.setCustomId('w3-characters')
					.setLabel('Characters')
					.setStyle('PRIMARY'),
        new Discord.MessageButton()
          .setCustomId('w3-creatures')
          .setLabel('Creatures')
          .setStyle('PRIMARY'),
        new Discord.MessageButton()
          .setCustomId('w3-quests')
          .setLabel('Quests')
          .setStyle('PRIMARY'),
			);
  interaction.reply({ content: "Pick one:", components: [row] })
}

async function w3characters(interaction) {
  axios.get('http://www.witcher3api.com/api/characters')
  .then(response => {
    const data = response.data;
    const embeds = [];
    data.forEach(character => {
      const characterEmbed = new Discord.MessageEmbed()
        .setAuthor(character.name, character.image)
        .setTitle(character.name)
        .addField("Gender", character.gender)
        .addField("Race", character.race)
        .addField("First Appearance", character.fappearance)
        .addField("Nationality", character.nationality)
        .setImage(character.image);
      embeds.push(characterEmbed);
    })

    paginator(interaction.user, interaction, embeds);
  })
}

async function w3creatures(interaction) {
  axios.get('http://www.witcher3api.com/api/creatures')
  .then(response => {
    const data = response.data;
    const embeds = [];
    data.forEach(creature => {
      const creatureEmbed = new Discord.MessageEmbed()
        .setAuthor(creature.name, creature.image)
        .setTitle(creature.name)
        .addField("Class", creature.class)
        .addField("Tactics", creature.tactics)
        .addField("Susceptibility", creature.susceptibility)
        .addField("Immunity", creature.immunity)
        .addField("Quests", creature.quest)
        .addField("Occurences", creature.occurences)
        .setImage(creature.image);
      embeds.push(creatureEmbed);
    })

    paginator(interaction.user, interaction, embeds);
  })
}

async function quote(interaction) {
  const randomQuote = quoteArray[Math.floor(Math.random()*quoteArray.length)];
  const quoteEmbed = new Discord.MessageEmbed()
  .setDescription(`> *${randomQuote.quote}*\n\n**― ${randomQuote.spokenBy}**`);

  interaction.reply({ embeds: [quoteEmbed] });
}

async function paginator(user, interaction, embeds) {
  let index = 0;

  const row = new Discord.MessageActionRow();
  row.addComponents(
    new Discord.MessageButton()
      .setCustomId('paginator-left')
      .setEmoji('868552005977788466')
      .setStyle('SECONDARY'),
    new Discord.MessageButton()
      .setCustomId('paginator-right')
      .setEmoji('868551772887711754')
      .setStyle('SECONDARY')
  );

  await interaction.reply({ content: `Page 1 of ${embeds.length}:`, embeds: [embeds[index]], components: [row] })
    .then(async () => {
      const paginatorMessage = await interaction.fetchReply();
      const filter = i => {
        i.deferUpdate();
        return i.user.id === user.id;
      }

      const paginatorCollector = paginatorMessage.createMessageComponentCollector({ filter, componentType: "BUTTON" });

      paginatorCollector.on('collect', async i => {
          switch(i.customId) {
            case 'paginator-left':
              index--;
              if (index < 0) index = embeds.length - 1;
              break;
            case 'paginator-right':
              index++;
              if (index > embeds.length - 1) index = 0;
              break;
          }
          paginatorMessage.edit({ content: `Page ${index + 1} of ${embeds.length}:`, embeds: [embeds[index]] });
        });
    });
}

client.login(process.env.TOKEN);
