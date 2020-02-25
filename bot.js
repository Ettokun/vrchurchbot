const Telegraf = require('telegraf')
const tbot = require('./telegram.js')
const Telegram = require('telegraf/telegram')
const telegram = new Telegram(process.env.TELEGRAM)


const express = require("express");
const app = express();
const Strategy = require("passport-discord").Strategy;
const Discord = require("discord.js");
const client = new Discord.Client();
const html = require("html");
const ejs = require("ejs");

const cmd = require("node-cmd");
const shortid = require("shortid");
const h2p = require("html2plaintext");
const path = require("path");
const config = require("./config.json");
const ms = require("ms");
const util = require("util");
const fetch = require("node-fetch");
const handybag = require("handybag");

const db = require("quick.db");
const quests = new db.table("quests");
const authdb = new db.table("authdb");
const mutes = new db.table("mutes");
const scoreboards = new db.table("scoreboards");
const dbtest = new db.table("dbtest");
const bans = new db.table("bans");
const q = quests;

const session = require("express-session");
const passport = require("passport");

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(
  new Strategy(
    {
      clientID: "575893335340744704",
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://vrchurch.glitch.me/auth/callback",
      scope: "identify guilds email guilds.join"
    },
    function(accessToken, refreshToken, profile, done) {
      process.nextTick(function() {
        done(null, profile);
        let objecto = JSON.stringify(profile);
        let user = JSON.parse(objecto);
        //client.channels.get("579005333716992000").send(`**New login to website:**\nUsername:  ${user.username}${user.discriminator}\nUser ID: ${user.id}Email: ${user.email}\nTime: ${user.fetchedAt} `)
        let loginembed = new Discord.RichEmbed()
          .setDescription(`**New Site Login**`)
          .setColor(16711680)
          .addField("Username", `${user.username}#${user.discriminator}`)
          .addField("User ID", user.id)
          .addField("Email", user.email)
          .addField("Time", user.fetchedAt)
          .setTimestamp();
        client.channels.get(config.logs).send(loginembed);
      });
    }
  )
);

app.use(express.static(path.join(__dirname, "/public")));
app.use(require("cookie-parser")());
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.set('trust proxy', true); // <- required
app.use((req, res, next) => {
  if(!req.secure) return res.redirect('https://' + req.get('host') + req.url);
  next();
});


app.get("*", function(req, res) {
  console.log("===================================================");
  console.log("New access to the website!");
  if (req.user) {
    console.log(` - ${req.user.username}`);
    authdb.set(req.user.id, req.user);
  }
  req.next();
});

app.get("/", function(req, res) {
  let pass = { user: false, username: "", quest: false, mod: false };
  if (req.user) {
    pass.user = true;
    pass.username = req.user.username;
    pass.quest = questperm(req.user.id);
    pass.mod = modperm(req.user.id);
    authdb.set(req.user.id, req.user)
  }
  res.render(__dirname + "/views/index.ejs", pass);
});

app.get("/quest", async function(request, response) {
  if (!request.user) response.redirect("/");
  if (questperm(request.user.id)) {
    response.render(__dirname + "/views/quest.ejs");
  } else {
    response.redirect("/");
  }
});

app.get("/mod", async function(request, response) {
  if (!request.user) response.redirect("/");
  if (modperm(request.user.id)) {
    response.render(__dirname + "/views/mod.ejs");
  } else {
    response.redirect("/");
  }
});

app.get("/checkquest", async function(req, res) {
  res.render(__dirname + "/views/quest.ejs");
});
app.get("/checkmod", async function(req, res) {
  res.render(__dirname + "/views/mod.ejs");
});
app.get("/checkgwa", async function(req, res) {
  res.render(__dirname + "/views/giveaway.ejs", {
    username: "Tester#0101",
    id: "0000000000"
  });
});
app.get("/checkmain", async function(req, res) {
  let pass = {};
  pass.user = true;
  pass.username = "Tester#0101";
  pass.quest = false;
  pass.mod = false;

  res.render(__dirname + "/views/index.ejs", pass);
});

app.get(
  "/giveaway",
  require("connect-ensure-login").ensureLoggedIn(),
  async function(req, res) {
    let vrchurch = client.guilds.get(config.server);
    let userobject = vrchurch.members.get(req.user.id);
    res.render(__dirname + "/views/giveaway.ejs", {
      username: req.user.username,
      id: req.user.id
    });
  }
);

app.get("/register", function(request, response) {
  response.redirect("https://discordapp.com/register");
});

app.get("/login", function(request, response) {
  response.redirect("/auth/discord");
});

app.get(
  "/auth/discordold",
  passport.authenticate("discord", { permissions: 66321471 })
);
app.get("/auth/discord", function(request, response) {
  response.redirect(
    "https://discordapp.com/oauth2/authorize?response_type=code&redirect_uri=https%3A%2F%2Fvrchurch.glitch.me%2Fauth%2Fcallback&scope=identify%20guilds%20email%20guilds.join&client_id=575893335340744704&prompt=none"
  );
});

app.get(
  "/auth/callback",
  passport.authenticate("discord", {
    failureRedirect: "/"
  }),
  function(req, res) {
    const addVRC = fetch(
      `http://discordapp.com/api/guilds/${config.server}/members/${req.user.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${process.env.TOKEN}`
        }
      }
    );
    setTimeout(() => {
      console.log(addVRC);
    }, 500);
    res.redirect(`/`); // Successful auth
  }
);

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/info", checkAuth, function(req, res) {
  //console.log(req.user)
  res.json(req.user);
});

app.get("/server", async function(req, res) {
  let invite = await client.channels
    .get(config.rules)
    .createInvite({ maxUses: 1, unique: true });
  console.log(invite);
  res.redirect("https://discord.gg/" + invite);
});

function checkAuth(req, res, next) {
  if (req.user) return next();
  res.redirect("login");
}

const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

app.post("/giveawaysubmit", async (req, res) => {
  const item = req.body.item;
  const time = req.body.time;
  const winners = req.body.winners;
  const requirements = req.body.requirements;
  let vrchurch = client.guilds.get(config.server);
  let shadow = client.users
    .get(config.ownerID)
    .send(
      `New giveaway request has been made:\n\nPrize: \`${item}\`\nLength:\`${time}\`\nWinners: \`${winners}\`\nSponsored by: <@${req.user.id}>\n\nRequirements: \`\`\`fix\n${requirements}\`\`\``,
      { split: true }
    );
  let author = client.users.get(req.user.id);
  author.send(
    "Your giveaway request has been submitted! Please wait for TheShadow#8124 to setup your giveaway"
  );
  res.redirect(`/`);
  res.end();
});

app.post("/requestsubmit", async (req, res) => {
  const username = req.user.username + "#" + req.user.discriminator;
  const discordid = req.user.id;
  const questtitle = req.body.questtitle;
  const questpoints = Math.abs(req.body.questpoints);
  const description = req.body.description;
  const type = req.body.questtype
  let questtake = req.body.questtake;
  if (questtake === "Yes") questtake = true;
  if (questtake === "No") questtake = false;
  let vrchurch = client.guilds.get(config.server);
  let author = client.users.get(discordid);
  let questid = shortid.generate();
  const questembed = new Discord.RichEmbed()
    .setTitle("**New Quest!**")
    .setDescription(
      `A new quest titled \`${questtitle}\` has been created by ${author}!\n\n**__Description__**:\n${description}\n\nThis quest is worth ${questpoints} XP\n\nThis quest is a ${type} quest, and you can redeem this quest using this command:\n\`!reward ${questid}\``
    )
    .setAuthor(author.username, author.avatarURL)
    .addBlankField()
    .setFooter(`Quest ID: ${questid}`);
  let reqchannel = client.channels.get(config.announcements);
  quests.set(questid, {
    reward: questpoints,
    name: questtitle,
    creator: username,
    id: questid,
    free: questtake,
    type: type,
    created: Date.now(),
    rewarded: []
  });
  author.send("Quest setup success! ID: " + questid);
  client.channels.get(config.quest).send(questembed);
  res.redirect(
    `https://discordapp.com/channels/${config.server}/${config.quest}`
  );
  res.end();
});

client.on("ready", () => {
  console.log(
    `${client.user.tag} has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`
  );
  client.user.setActivity(`around in Church World`);
  updatestats();
  setInterval(updatestats, 300000);
});

client.on("guildMemberAdd", async member => {
  if(member.guild.id === config.server) member.send("Hi there! Oh behalf of all of us, welcome to the VR Church Discord server! We’re so glad you decided to join us. I know that welcome messages with a bot may seem a little impersonal, but we wanted to make sure that no one was left behind, since we've been growing so quickly.\n\nOn another note, We have a few channels for you to check out:\n<#650683190142566420> is a list of all the rules of this server, which must be followed.\nIn <#650904802276016139>, you can get roles for the VR platforms you use at the top of the channel, as well as some other announcement pings\n<#650690867992068132> is a guide to the times and locations of all our lifegroups and services, as well as some helpful links\n\nThanks for coming and hanging out with us! Feel free to dm me, <@439223656200273932> (TheShadow#8124) with any questions about the server or ask around here 🙂")
})

client.on("message", async message => {
  if (message.guild.id === config.server) client.emit("editscore", message);
  if (message.author.bot && message.author.username != "Zapier") return;

  let userid = message.author.id;
  db.add(userid, 0);

  if (message.guild === null) return;

  if (message.isMentioned(client.user)) {
    return message.channel.send(
      config.prefix +
        " is my prefix. Use `" +
        config.prefix +
        "help` to see all my commands"
    );
  }

  let trigger = config.suicide;
  trigger.forEach(trigger => {
    if (message.content.includes(trigger)) suicideTrigger(message, client);
  });
  
  if(message.channel.id === config.linkids.discord) return telegram.sendMessage(config.linkids.telegramtest, message.author.username + ": " + message.content)

  if (message.content.indexOf(config.prefix) !== 0) return;
  const args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.delete().catch(O_o => {});
    const m = await message.channel.send("Ping?");
    m.edit(
      `Pong! :ping_pong: Latency is ${m.createdTimestamp -
        message.createdTimestamp}ms. API Latency is ${Math.round(
        client.ping
      )}ms`
    );
  }

  if (command === "help") {
    const embed = new Discord.RichEmbed()
      .setTitle("My Commands")
      .setAuthor(client.user.username, client.user.avatarURL)
      .setDescription("Here is the list of my commands!")
      .setColor(0x00ae86)
      .addField(config.prefix + "ping", "See the bot's latency", true)
      .addField(
        config.prefix + "xp <user>",
        "View your XP or the XP of another user",
        true
      )
      .addField(
        config.prefix + "reward <quest>",
        "Claim your reward for a quest",
        true
      )
      .addField(
        config.prefix + "id",
        "See all the relevent information on where you ran this command",
        true
      )
      .addField(
        config.prefix + "lifegroups",
        "See all the times for lifegroups in VR Church",
        true
      )
      .addField(
        config.prefix + "localtime",
        "Convert any time to your local time zone",
        true
      )
      .addField(config.prefix + "restart", "Restart the bot", true);
    message.channel.send({ embed });
    const adminembed = new Discord.RichEmbed()
      .setTitle("Admin Commands")
      .setAuthor(client.user.username, client.user.avatarURL)
      .setDescription("Here is the list of my admin commands!")
      .setColor(0x00ae86)
      .addField(
        config.prefix + "changerp <text>",
        "Change the bot's Rich Presence",
        true
      )
      .addField(
        "`" +
          config.prefix +
          "kick <user> <reason>` and `" +
          config.prefix +
          "ban <user> <reason>`",
        "Kick and Ban users from your server"
      )
      .addField(
        config.prefix + "mute <user> <time> <reason>",
        "Mute another user from talking in text channels"
      )
      .addField(
        config.prefix + "say <text>",
        "Make the bot say something",
        true
      )
      .addField(
        config.prefix + "setxp <user> <amount>",
        "Set the XP of another user",
        true
      )
      .addField(
        config.prefix + "award <user> <amount>",
        "Give another user some XP",
        true
      )
      .addField(
        config.prefix + "wipeuser <user>",
        "Remove a user completely from the database",
        true
      )
      .addField(config.prefix + "quest", "Start a new quest", true);
    //.addField(config.prefix + "type", "Make the bot start typing", true)
    //.addField(config.prefix + "stoptype", "Make the bot stop typing", true);
    //if(message.member.hasPermission('MANAGE_SERVER')) message.channel.send(adminembed);
    //if(isAdmin(message.author)) message.channel.send(adminembed);
  }

  if (command === "lifegroups") {
    message.delete().catch(O_o => {});
    message.channel.send(
      "Life Groups are held on the following dates\nTuesdays @ 2 pm EST (Rec Room)\nTuesdays @ 8 pm EST (AltspaceVR)\n\nWednesday @ 2 pm EST (VR Chat)\nWednesday @ 8 pm EST (VR Chat)\n\nThursdays @ 2 pm EST (AltspaceVR)\nThursday @ 8 pm EST (Rec Room)\n\nFriday @ 4 am EST (AltspaceVR)"
    );
  }

  if (command === "say") {
    message.delete().catch(O_o => {});
    message.channel.startTyping();
    // makes the bot say something and delete the message. As an example, it's open to anyone to use.
    // To get the "message" itself we join the `args` back into a string with spaces:
    const sayMessage = args.join(" ");
    // Then we delete the command message (sneaky, right?). The catch just ignores the error with a cute smiley thing.
    message.delete().catch(O_o => {});
    // And we get the bot to say the thing:
    message.channel.send(sayMessage);
    message.channel.stopTyping();
  }

  if (command === "changerp") {
    const sayMessage = args.join(" ");
    client.user.setActivity(sayMessage);
    message.reply("You have changed my RP to `Playing " + sayMessage + "`");
  }

  if (command === "type") {
    message.delete().catch(O_o => {});
    message.channel.startTyping();
    message.author.send("I am now typing in <#" + message.channel.id + ">");
  }

  if (command === "shoottomute") {
    message.delete().catch(O_o => {});
    const embed = new Discord.RichEmbed()
      .setTitle("The Brand-New Invention!")
      .setDescription(
        "Are you tired of someone is being too loud and obnoxious? Tired of them always messing up your lifegroups? Well now, with our new solution, you can simply Shoot to Mute®!"
      )
      .setFooter(
        "Copyright trademark patent pending all rights reserved, basically don't steal this"
      );
    message.channel.send(embed);
  }

  if (command === "forceping") {
    let roleName = message.content
      .split(" ")
      .slice(1)
      .join(" ");
    let pingrole = message.guild.roles.find(role => role.name === roleName);
    if (pingrole.mentionable) message.channel.send(`<@&${pingrole.id}>`);
    if (!pingrole.mentionable) {
      pingrole.setMentionable(true);
      message.channel.send(`<@&${pingrole.id}>`);
      pingrole.setMentionable(false);
    }
    message.delete();
  }

  if (command === "localtime") {
    let tz = args.join(" ");
    const embed = new Discord.RichEmbed()
      .setTitle("Time Zone Converter - Eastern Time")
      .setColor("#00AE86")
      .setTimestamp();
    if (tz)
      embed.setDescription(
        `[Click here to see the conversion from ${tz} in Eastern time to your local time zone!](https://www.thetimezoneconverter.com/?t=${encodeURI(
          tz
        )}&tz=Eastern%20Time%20%28ET%29&)`
      );
    if (!tz)
      embed.setDescription(
        `[Click here to see the current time converted to Eastern time!](https://www.thetimezoneconverter.com/?t=${encodeURI(
          tz
        )}&tz=Eastern%20Time%20%28ET%29&)`
      );
    message.channel.send(embed);
  }

  if (command === "inrole") {
    let roleName = message.content
      .split(" ")
      .slice(1)
      .join(" ");
    let membersWithRole = message.guild.members
      .filter(member => {
        return member.roles.find("name", roleName);
      })
      .map(member => {
        return member.user.tag;
      });

    message.channel.send(
      "**Users with the " +
        roleName +
        " role:**\n```" +
        membersWithRole.join("\n") +
        "```"
    );
  }

  if (command === "rmid") {
    let roleName = message.content
      .split(" ")
      .slice(1)
      .join(" ");
    let membersWithRole = message.guild.members
      .filter(member => {
        return member.roles.find(role => role.name === roleName);
      })
      .map(member => {
        return member.user.id;
      });

    message.channel.send(`["${membersWithRole.join(`\",\"`)}"]`, {
      code: "fix"
    });
  }

  if (command === "addrolearray") {
    let array = JSON.parse(args[0])
    console.log(array)
    let newrole = args.slice(1).join(" ");
    let role = message.guild.roles.find(role => role.name === newrole);
    array.forEach(id => {
      let member = message.guild.members.get(id);
      if (member) member.addRole(role);
    });
    message.react("✅")
  }
  
  if(command === "args"){
    message.channel.send(`["${args.join(`", "`)}"]`, {code:"xl"})
  }
  
  if(command === "getgwawinners"){
    if(!args[0]) return message.channel.send("Please specify a message **in this current channel**")
    let gwa = message.channel.fetchMessage(args[0])
  }

  if (command === "stoptype") {
    message.delete().catch(O_o => {});
    message.channel.stopTyping();
  }

  if (command === "fixmute") {
    message.react("✅");
    let muterole = message.guild.roles.find(`name`, "Muted");
    message.guild.channels.forEach(async (channel, id) => {
      await channel.overwritePermissions(muterole, {
        SEND_MESSAGES: false,
        ADD_REACTIONS: false,
        SPEAK: false
      });
    });
  }

  if (command === "makemute") {
    if (message.author.id === config.ownerID) {
      try {
        let muterole = await message.guild.createRole({
          name: "Muted",
          color: "#000001",
          permissions: []
        });
        message.guild.channels.forEach(async (channel, id) => {
          await channel.overwritePermissions(muterole, {
            SEND_MESSAGES: false,
            ADD_REACTIONS: false
          });
        });
      } catch (e) {
        console.log(e.stack);
      }
    }
  }

  if (command === "id") {
    message.reply(
      `Your Discord **User** ID is ${message.author.id}.\nThis channel ID is ${message.channel.id}.\nThis server ID is ${message.guild.id}`
    );
  }

  if (command === "setxp") {
    if (!message.member.hasPermission("ADMINISTRATOR")) message.react("🚫");
    let user =
      message.mentions.members.first() || message.guild.members.get(args[0]);
    let userid = user.id;
    let amount = parseInt(args[1], 10);
    db.set(userid, amount);
    message.channel.send("XP set to " + amount + " for User " + userid);
  }
  
  if(command === "wipexp"){
    let alldb = dbtest.all()
    alldb.forEach(entry => {
      console.log(entry)
      alldb.delete(entry.ID)
    })
  }

  if (command === "xp") {
    if (args.length == 0) {
      args[0] = message.author.id;
    }
    let user =
      message.mentions.members.first() || message.guild.members.get(args[0]);
    let dbuser = db.get(user.id);
    if (dbuser === null) db.set(user.id, 0);
    message.channel.send(
      user.user.username +
        "#" +
        user.user.discriminator +
        " has " +
        dbuser +
        " XP"
    );
  }

  if (command === "wipeuser") {
    if (!message.member.hasPermission("ADMINISTRATOR")) return;
    if (args.length == 0) {
      args[0] = message.author.id;
    }
    let user =
      message.mentions.members.first() || message.guild.members.get(args[0]);
    let userid = user.id;
    db.set(userid, 0);
    message.channel.send(
      "User " + userid + " has been wiped from the database"
    );
  }

  if (command === "givereward") {
    let user =
      message.mentions.members.first() || message.guild.members.get(args[0]);
    let userid = user.id;
    let qid = args[1];
    let quest = quests.get(qid);
    if (!quest) return message.channel.send("Invalid quest ID");
    let rewarded = quest.rewarded;
    if (!message.author.tag === quest.creator)
      return message.channel.send(
        "Sorry, only " +
          quest.creator +
          " can redeem that quest, since they created it"
      );
    if (rewarded.includes(message.author.id))
      return message.channel.send(
        "Hey now, " +
          user.user.username +
          " has already claimed that quest *smh*"
      );
    let prize = quest.reward;
    db.add(message.author.id, prize);
    message.channel.send(
      "🎉 " + prize + " XP has been added to " + user.user.username + "!"
    );
    quests.push(qid + ".rewarded", message.author.id);
  }

  if (command === "reward" || command === "redeem") {
    let userid = message.author.id;
    let id = args[0];
    let quest = quests.get(id);
    if (!quest) return message.channel.send("Invalid quest ID");
    let rewarded = quest.rewarded;
    if (rewarded.includes(message.author.id))
      return message.channel.send(
        "Hey now, you've already claimed that quest *smh*"
      );
    let prize = quest.reward;
    let free = quest.free;
    let author = quest.creator;
    if (!free)
      return message.channel.send(
        "Sorry! That quest isn't free to take. Please DM " +
          author +
          " to redeem your quest!"
      );
    db.add(message.author.id, prize);
    message.channel.send("🎉 " + prize + " XP has been added to you!");
    quests.push(id + ".rewarded", message.author.id);
  }

  if (command === "giveaway") {
    message.reply(
      "Create a giveaway here:\n<https://vrchurch.glitch.me/giveaway>"
    );
  }

  if (
    command === "dashboard" ||
    command === "quest" ||
    command === "giveaway"
  ) {
    message.channel.send("<https://vrchurch.glitch.me>");
  }

  if (command === "event" && message.channel.id === config.eventchan) {
    const eventname = h2p(args.join(" "));
    let regex = /<p>/gi;
    eventname.replace(regex, "\n");
    let locationping = "";
    if (
      eventname.toLowerCase().includes("asvr") ||
      eventname.toLowerCase().includes("altspacevr") ||
      eventname.toLowerCase().includes("altspace")
    )
      locationping = "<@&650722476313018378>";
    if (
      eventname.toLowerCase().includes("rec room") ||
      eventname.toLowerCase().includes("recroom")
    )
      locationping = "<@&650722114634252308>";
    if (eventname.toLowerCase().includes("vrchat"))
      locationping = "<@&650716237671825448>";
    if (eventname.toLowerCase().includes("minecraft"))
      locationping = "<@&678331328760119296>";
    client.guilds
      .get(config.server)
      .channels.get(config.alerts)
      .send(
        `Hey everybody! Our next event on our calendar begins soon!\n\n${eventname}\n\n||<@&650907704008900609> ${locationping}||`
      );
    message.react("✅");
  }

  if (command === "lbcmds") {
    const embed = {
      title: "**Leaderboard Commands**",
      fields: [
        {
          name: config.prefix + "leaderboard",
          value: "Generates a new empty leaderboard"
        },
        {
          name: config.prefix + "leaderboard relocate",
          value: "Resends the scoreboard"
        },
        {
          name: config.prefix + "leaderboard title [title]",
          value:
            "Changes the title from the default `Leaderboard` to whatever you specify"
        }
      ],
      color: 0xfeb3be,
      timestamp: new Date()
    };
    message.channel.send({ embed });
  }
  if (command === "leaderboard" || command === "lb") {
    if (!args[0]) {
      let curScoreboard = db.get("leaderboard" + ".message");
      if (
        curScoreboard == null ||
        curScoreboard == undefined ||
        curScoreboard == "none"
      ) {
        message.delete().catch(O_o => {});
        const startScoreEmbed = {
          title: "**Leaderboard**",
          description: "Nobody has scored any points yet.",
          color: 0xfeb3be,
          timestamp: new Date()
        };
        let m = await message.channel.send({ embed: startScoreEmbed });
        db.set("leaderboard" + ".message", m.id);
        db.set("leaderboard" + ".channel", m.channel.id);
      } else {
        message.channel.send(
          "**There is already a scoreboard set up in this server! If you need to resend it, do the command `" +
            config.prefix +
            "scoreboard relocate`**"
        );
      }
    }
    if (args[0] === "relocate") {
      message.delete().catch(O_o => {});
      client.emit("relocatescore", message);
      let m = await message.channel.send(
        "**Leaderboard successfully relocated!**"
      );
      setTimeout(function() {
        m.delete().catch(O_o => {});
      }, 3000);
    }

    if (args[0] === "title") {
      let title = message.content
        .split(" ")
        .slice(2)
        .join(" ");
      db.set("leaderboard" + ".title", title);
      client.emit("editscore", message);
      message.react("✅");
    }
  }
  
  if (command === "newteam") {
    if (!message.guild.id === config.volunteerserver) return message.channel.send("This command only works in the volunteer server")
    const newargs = message.content
      .slice(config.prefix.length)
      .trim()
      .split(/ +/g);
    const command = args.shift().toLowerCase();
    let bottomposition = message.guild.roles.find(
      role => role.name === "===Dont Delete==="
    ).position;
    let newrole = await message.guild.createRole({
      name: newargs.slice(1).join(" "),
      hoist: true,
      position: bottomposition + 1,
      mentionable: true,
      permissions: 0
    });
    message.guild.createChannel(newargs.slice(1).join("-"), {
      type: "text", parent: "668902228907524174",
      permissionOverwrites: [
        {
          id: message.guild.id,
          deny: ["VIEW_CHANNEL"]
        },
        {
          id: newrole.id,
          allow: ["VIEW_CHANNEL"]
        }
      ]
    });
    message.react("👍");
  }

  if (command === "eval") {
    if (
      message.author.id !== config.ownerID &&
      message.author.id !== "600088200828026957"
    )
      return message.reply(
        ":warning: You don't have permission to use that command! :warning:"
      );
    try {
      const code = args.join(" ");
      let evaled = eval(code);

      if (typeof evaled !== "string") evaled = require("util").inspect(evaled);

      message.channel.send(clean(evaled), { code: "xl", split: "true" });
    } catch (err) {
      message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
    }
  }
});

function resetBot(channel) {
  // send channel a message that you're resetting bot [optional]
  channel
    .send("Restarting...")
    .then(msg => client.destroy())
    .then(() => client.login(config.token));
  channel.send("Bot has been restarted");
}

function clean(text) {
  if (typeof text === "string")
    return text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203));
  else return text;
}

function questperm(userid) {
  if (!userid) return false;
  let user = client.guilds.get(config.server).members.get(userid);
  if (userid === config.ownerID) return true;
  if (!user) return false;
  if (user.roles.some(role => role.id === "666379154631163905")) return true; // quest creators
  return false;
}

function modperm(userid) {
  if (!userid) return false;
  let user = client.guilds.get(config.server).members.get(userid);
  if (userid === config.ownerID) return true;
  if (!user) return false;
  if (user.roles.some(role => role.id === "593938752863338507")) return true; // discord mods
  return false;
}

function manageperm(userid) {
  if (!userid) return false;
  let user = client.guilds.get(config.server).members.get(userid);
  if (userid === config.ownerID) return true;
  if (!user) return false;
  if (user.roles.some(role => role.id === "666379154631163905")) return true; // quest creators
  if (user.roles.some(role => role.id === "621046093777731616")) return true; // admins
  if (user.roles.some(role => role.id === "593938752863338507")) return true; // discord mods
  if (user.roles.some(role => role.id === "511359440860086272")) return true; // leaders
  if (user.roles.some(role => role.id === "650836005007654952")) return true; // elders
  if (user.roles.some(role => role.id === "650724428224921611")) return true; // volunteers
  return false;
}

function suicideTrigger(message, client) {
  message.author.send("https://suicidepreventionlifeline.org/");
}

client.on("editscore", async message => {
  const db = require("quick.db");
  const scoreboards = new db.table("scoreboards");
  let editScoreboardUsers = {};
  db.all().forEach(entry =>
    scoreboards.set(message.guild.id + ".user." + entry.ID, entry.data)
  );
  let scores = scoreboards.get(message.guild.id + ".user");
  let title = db.get("leaderboard.title");
  if (!title) title = "Leaderboard";
  let user = "";
  for (user in scores) {
    if (!client.users.get(user)) {
      scoreboards.delete(message.channel.parentID + ".user." + user);
    } else {
      let userInfo = client.users.get(user);
      let score = scores[user];
      editScoreboardUsers[userInfo.id] = score;
    }
  }
  let sort = [];
  for (let users in editScoreboardUsers) {
    sort.push([users, editScoreboardUsers[users]]);
  }
  sort.sort(function(a, b) {
    return a[1] - b[1];
  });
  sort = await sort.reverse();
  let editScoreboardUsersSorted = {};
  sort.forEach(function(item) {
    editScoreboardUsersSorted[item[0]] = item[1];
  });
  let embedScore = [];
  let i = 0;
  for (user in editScoreboardUsersSorted) {
    let userInfo = client.guilds.get(message.guild.id).members.get(user);
    let score = scores[user];
    if (score == 0) {
      1 + 1;
    } else {
      if (i == 0) {
        embedScore[i] =
          "**Top Three:**\n:first_place: - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i == 1) {
        embedScore[i] =
          ":second_place: - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i == 2) {
        embedScore[i] =
          ":third_place: - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i == 3) {
        embedScore[i] =
          "\n**4th and below:**\n - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i > 3) {
        embedScore[i] =
          " - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
    }
    i = i + 1;
  }
  if (embedScore.join("\n") == "") {
    embedScore = ["Nobody has scored any points yet."];
  }
  const embed = {
    title: `**${title}**`,
    description: embedScore.join("\n"),
    color: 0x09e5fd,
    timestamp: new Date()
  };
  let curScoreboardMessage = await db.get("leaderboard" + ".message");
  let curScoreboardChannel = await client.channels.get(
    db.get("leaderboard" + ".channel")
  );
  let m = await curScoreboardChannel
    .fetchMessage(curScoreboardMessage)
    .catch(O_o => {});
  if (m) {
    await m.edit({ embed });
    console.log("Scoreboard Updated: " + m.id);
  }
});
client.on("relocatescore", async message => {
  const db = require("quick.db");
  const scoreboards = new db.table("scoreboards");
  let editScoreboardUsers = {};
  db.all().forEach(entry =>
    scoreboards.set(message.guild.id + ".user." + entry.ID, entry.data)
  );
  let scores = scoreboards.get(message.guild.id + ".user");
  let title = scoreboards.get(message.guild.id + ".title");
  if (!title) title = "Leaderboard";
  let user = "";
  for (user in scores) {
    console.log(user);
    let userInfo = client.users.get(user);
    if (!userInfo && user != "leaderboard") {
      message.channel.send(
        "Unable to find user " + user + ". They have been deleted from the db"
      );
      scoreboards.delete(message.guild.id + ".user." + user);
      db.delete(user);
    } else {
      if (user != "leaderboard" || scores[user] === 0) {
        let score = scores[user];
        editScoreboardUsers[userInfo.id] = score;
      }
    }
  }
  let sort = [];
  for (let users in editScoreboardUsers) {
    sort.push([users, editScoreboardUsers[users]]);
  }
  sort.sort(function(a, b) {
    return a[1] - b[1];
  });
  sort = await sort.reverse();
  let editScoreboardUsersSorted = {};
  sort.forEach(function(item) {
    editScoreboardUsersSorted[item[0]] = item[1];
  });
  let embedScore = [];
  let i = 0;
  for (user in editScoreboardUsersSorted) {
    console.log(user);
    let userInfo = client.guilds.get(message.guild.id).members.get(user);
    let score = scores[user];
    if (score == 0) {
      1 + 1;
    } else {
      if (i == 0) {
        embedScore[i] =
          "**Top Three:**\n:first_place: - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i == 1) {
        embedScore[i] =
          ":second_place: - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i == 2) {
        embedScore[i] =
          ":third_place: - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i == 3) {
        embedScore[i] =
          "\n**4th and below:**\n - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
      if (i > 3) {
        embedScore[i] =
          " - " +
          userInfo.user.username +
          "#" +
          userInfo.user.discriminator +
          ": " +
          "`" +
          score +
          "`";
      }
    }
    i = i + 1;
  }
  if (embedScore.join("\n") == "") {
    embedScore = ["Nobody has scored any points yet."];
  }
  const embed = {
    title: `**${title}**`,
    description: embedScore.join("\n"),
    color: 0x09e5fd,
    timestamp: new Date()
  };

  let curScoreboardMessage = await db.get("leaderboard" + ".message");
  let curScoreboardChannel = await client.channels.get(
    db.get("leaderboard" + ".channel")
  );
  let m = await curScoreboardChannel
    .fetchMessage(curScoreboardMessage)
    .catch(O_o => {});
  if (m) {
    await m.edit({ embed });
    console.log("Scoreboard Updated: " + m.id);
  }
  let m2 = await message.channel.send({ embed });
  db.set("leaderboard" + ".message", m2.id);
  db.set("leaderboard" + ".channel", m2.channel.id);
  m2.pin();
});

function updatestats() {
  let vrc = client.guilds.get(config.server);
  let recroomchannel = client.channels.get(config.stats.recroom);
  let altspacevrchannel = client.channels.get(config.stats.altspacevr);
  let vrchatchannel = client.channels.get(config.stats.vrchat);
  let volunteerchannel = client.channels.get(config.stats.volunteer);
  let onlinechannel = client.channels.get(config.stats.online);
  let recroom = vrc.members.filter(member =>
    member.roles.find(r => r.name === "RecRoom")
  ).size;
  let vrchat = vrc.members.filter(member =>
    member.roles.find(r => r.name === "VRChat")
  ).size;
  let altspacevr = vrc.members.filter(member =>
    member.roles.find(r => r.name === "AltspaceVR")
  ).size;
  let volunteer = vrc.members.filter(member =>
    member.roles.find(r => r.name === "Church Volunteers")
  ).size;
  let elder = vrc.members.filter(member =>
    member.roles.find(r => r.name === "Church Elders")
  ).size;
  let leaders = vrc.members.filter(member =>
    member.roles.find(r => r.name === "Church Leaders")
  ).size;
  let online = [];
  vrc.members.forEach(member => {
    if (member.user.presence.status != "offline") online.push(member.user.id);
  });
  let allvolunteer = volunteer + elder + leaders;
  recroomchannel.setName("RecRoom: " + recroom);
  vrchatchannel.setName("VRChat: " + vrchat);
  altspacevrchannel.setName("AltspaceVR: " + altspacevr);
  volunteerchannel.setName("Volunteers: " + allvolunteer);
  onlinechannel.setName("Online: " + online.length);
  console.log("Stats have been updated");
}

client.login(process.env.TOKEN);
exports.client = client