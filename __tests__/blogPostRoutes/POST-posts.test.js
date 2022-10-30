const index = require("../../routes/index.js");
var cookieParser = require("cookie-parser");
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Post = require("../../models/post");
const fetch = require("node-fetch");

const app = express();
require("../../config/passport");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use("/", index);

jest.mock("node-fetch");

const userPayload = {
  firstName: "John",
  lastName: "Doe",
  email: "john@gmail.com",
  password: "12345678",
  confirmPassword: "12345678",
};
const adminPayload = {
  ...userPayload,
  email: "johnadmin@gmail.com",
  adminCode: `${process.env.ADMIN_CODE}`,
};

const validPostPayload = {
  title: "test title",
  image: "https://i.imgur.com/0vSEb71.jpg",
  content: "test content",
  tags: ["test", "test2"],
  featured: true,
  published: true,
};

describe("POST /posts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.restoreAllMocks();
  });
  beforeAll(async () => {
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await request(app).post("/users").send(userPayload);
    await request(app).post("/users").send(adminPayload);
  });
  afterEach(async () => {});
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoose.connection.close();
  });

  it("should return 401 if token is not provided", async () => {
    const res = await request(app).post("/posts");
    expect(res.statusCode).toEqual(401);
  });

  it("should return 401 if token is not valid", async () => {
    const res = await request(app)
      .post("/posts")
      .set("Authorization", "Bearer 123");
    expect(res.statusCode).toEqual(401);
  });

  it("should return 403 if user is not admin", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: userPayload.email, password: userPayload.password });
    const token = tokenRes.body.token;

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toEqual(403);
  });

  it("should return 400 if data is not provided", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toEqual(400);
  });

  it("should return 400 and error array with 6 items if data is not valid", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "a",
        image: "a",
        content: "a",
        tags: "a",
        featured: 4,
        published: 7,
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.errors.length).toEqual(7);
  });

  it("should return 400 if tags array is empty or contains more than 20 tags", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPostPayload,
        tags: [],
      });
    expect(res.statusCode).toEqual(400);

    const res2 = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPostPayload,
        tags: new Array(21).fill("test"),
      });
    expect(res2.statusCode).toEqual(400);
  });

  it("should return 500 if Post.findOne() throws an error", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    jest.spyOn(Post, "findOne").mockImplementationOnce((filter, callback) => {
      callback(new Error("error"), null);
    });

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it("should return 500 if post.updateMany() throws an error", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    jest.spyOn(Post, "updateMany").mockImplementationOnce(() => {
      throw new Error("error");
    });

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it("should return 500 if post.save() throws an error", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    jest.spyOn(Post.prototype, "save").mockImplementationOnce((callback) => {
      return callback(new Error("error"));
    });

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it("fetch should be called if image is non imgur url", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPostPayload,
        image:
          "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
      });

    expect(fetch).toHaveBeenCalled();
  });

  it("should return 500 if fetch throws an error", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    jest.spyOn(fetch, "default").mockImplementationOnce(() => {
      throw new Error("error");
    });

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPostPayload,
        image:
          "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
      });

    expect(res.statusCode).toEqual(500);
  });

  it("should return 500 if post.save() throws an error after imgur upload", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    jest.spyOn(fetch, "default").mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => {
          return Promise.resolve({
            data: {
              link: "https://i.imgur.com/123.png",
            },
          });
        },
      });
    });

    jest.spyOn(Post.prototype, "save").mockImplementationOnce(() => {
      throw new Error("error");
    });

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPostPayload,
        image:
          "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
      });

    expect(res.statusCode).toEqual(500);
  });

  it("should return 201 if post is created", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(201);
  });

  it("should return 201 if post is created without first having imgur link", async () => {
    const tokenRes = await request(app)
      .post("/users/login")
      .send({ email: adminPayload.email, password: adminPayload.password });
    const token = tokenRes.body.token;

    jest.spyOn(fetch, "default").mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => {
          return Promise.resolve({
            data: {
              link: "https://i.imgur.com/123.png",
            },
          });
        },
      });
    });

    const res = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPostPayload,
        image:
          "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
      });

    expect(res.statusCode).toEqual(201);
  });
});
