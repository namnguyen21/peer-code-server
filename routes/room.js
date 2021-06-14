const router = require("express").Router();
const redis = require("redis");
const { v4: uuid } = require("uuid");
const { promisify } = require("util");
require("dotenv").config();

const HOURS_TILL_EXPIRATION = 24;
const BASE_THEME = "Base16 Light";
const BASE_LANGUAGE = "Python";

const colors = [
  "#7289da",
  "#9256da",
  "#317e54",
  "#2272a4",
  "#a4569a",
  "#637983",
];
const client = redis.createClient(process.env.REDIS_ENDPOINT);
client.auth(process.env.REDIS_PASSWORD);

client.on("error", (err) => {
  console.log(err);
});

const exists = promisify(client.exists).bind(client);
const rpush = promisify(client.rpush).bind(client);
const lrange = promisify(client.lrange).bind(client);
const expire = promisify(client.expire).bind(client);
const hset = promisify(client.hset).bind(client);
const hgetall = promisify(client.hgetall).bind(client);
const hincrby = promisify(client.hincrby).bind(client);

async function createUniqueID(req, res, next) {
  const id = uuid();
  try {
    const doesExist = await exists(`members:${id}`);
    if (doesExist === 0) {
      req.uuid = id;
      next();
    } else {
      //id already exists
      createUniqueID();
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
}

// creating a new room
router.get("/create", createUniqueID, async (req, res) => {
  const newID = req.uuid;

  try {
    await hset(
      `room:${newID}`,
      "members",
      0,
      "theme",
      BASE_THEME,
      "language",
      BASE_LANGUAGE
    );
    await expire(`room:${newID}`, 3600 * HOURS_TILL_EXPIRATION);
    res.json({ roomID: newID });
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }

  // try {
  //   await setex(`members:${newID}`, 3600 * HOURS_TILL_EXPIRATION, 0);
  //   res.json({ roomID: newID });
  // } catch (err) {
  //   if (err) {
  //     res.sendStatus(500);
  //     throw err;
  //   }
  // }
});

router.get("/join/:roomID", async (req, res) => {
  const { roomID } = req.params;

  try {
    const doesExist = await exists(`room:${roomID}`);
    if (doesExist === 1) {
      await hincrby(`room:${roomID}`, "members", 1);
      const roomInfo = await hgetall(`room:${roomID}`);
      let assignedColor;
      if (parseInt(roomInfo.members) % 6 === 0) {
        assignedColor = colors[5];
      } else {
        assignedColor = colors[(parseInt(roomInfo.members) % 6) - 1];
      }
      console.log(roomInfo.members, assignedColor);
      res.json({ ...roomInfo, color: assignedColor });
    }
    if (doesExist === 0) {
      res.json({ error: "Invalid room" });
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

router.get("/:id/chat", async (req, res) => {
  const { id } = req.params;
  try {
    const results = await lrange(`messages:${id}`, 0, -1);
    for (let i = 0; i < results.length; i++) {
      results[i] = JSON.parse(results[i]);
    }
    res.json(results);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

router.post("/:id/chat", async (req, res) => {
  const { id } = req.params;
  const content = JSON.stringify(req.body);
  try {
    const doesExist = await exists(`messages:${id}`);
    await rpush(`messages:${id}`, content);
    if (doesExist === 0) {
      await expire(`messages:${id}`, 3600 * HOURS_TILL_EXPIRATION);
    }
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

router.patch("/:roomID/config", async (req, res) => {
  const { roomID } = req.params;
  const { theme, language } = req.body;
  try {
    await hset(`room:${roomID}`, "theme", theme, "language", language);
    const updated = await hgetall(`room:${roomID}`);
    console.log(updated);
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

module.exports = router;
