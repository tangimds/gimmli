const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const yup = require("yup");
const monk = require("monk");
const { nanoid } = require("nanoid");

require("dotenv").config();

const db = monk(process.env.MONGODB_URI);
const domain = process.env.DOMAIN_URL;

const urls = db.get("urls");
urls.createIndex({ slug: 1 }, { unique: true });

const app = express();

app.use(helmet());
app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());
app.use(express.static("./public"));

const notFoundPath = path.join(__dirname, "public/404.html");

app.get("/:id", async (req, res, next) => {
  const { id: slug } = req.params;
  try {
    const url = await urls.findOne({ slug });
    if (url) {
      return res.redirect(url.url);
    }
    return res.status(404).sendFile(notFoundPath);
  } catch (error) {
    return res.status(404).sendFile(notFoundPath);
  }
});

const schema = yup.object().shape({
  slug: yup
    .string()
    .trim()
    .matches(/^[\w\-]+$/i),
  url: yup.string().trim().url().required(),
});

app.post("/url", async (req, res, next) => {
  let { slug, url } = req.body;
  try {
    await schema.validate({
      slug,
      url,
    });
    if (url.includes(domain)) {
      throw new Error("Stop it. 🛑");
    }
    if (!slug) {
      slug = nanoid(5);
    } else {
      const existing = await urls.findOne({ slug });
      if (existing) {
        throw new Error("Slug in use.");
      }
    }
    slug = slug.toLowerCase();
    const newUrl = {
      url,
      slug,
    };
    const created = await urls.insert(newUrl);
    res
      .status(200)
      .send({ ok: true, data: { ...created, shortUrl: `${domain}/${slug}` } });
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  res.status(404).sendFile(notFoundPath);
});

app.use((error, req, res, next) => {
  if (error.status) {
    res.status(error.status);
  } else {
    res.status(500);
  }
  res.json({
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack,
  });
});

const port = process.env.PORT || 1997;
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
