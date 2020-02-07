const Telegraf = require('telegraf')
const bot = new Telegraf(process.env.TELEGRAM)
const Discord = require('discord.js')
const client = new Discord.Client();
const config = require("./config.json")

bot.on('text', (ctx) => {
  client.channels.get(config.linkids.discord).send(`${ctx.message.from.first_name}: ${ctx.message.text}`)
  console.log(ctx.message)
})

bot.command('test', (ctx) => {
  ctx.reply("Hi! I'm alive... maybe...")
})

bot.start()

bot.launch()
client.login(process.env.TOKEN)

exports.bot = bot