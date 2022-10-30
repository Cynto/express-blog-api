const index = require("../../routes/index.js");
var cookieParser = require("cookie-parser");
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const passport = require("passport");
const User = require("../../models/user");
const Post = require("../../models/post");
const Comment = require("../../models/comment");

const app = express();
require("../../config/passport");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use("/", index);

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

describe("GET /posts/:url", () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
  let post;
  let unpublishedPost;
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

    const userRes = await request(app).post("/users/login").send(userPayload);
    userToken = userRes.body.token;

    const adminRes = await request(app).post("/users/login").send(adminPayload);
    adminToken = adminRes.body.token;

    user = await User.findOne({ email: userPayload.email });
    admin = await User.findOne({ email: adminPayload.email });

    const newPost = await new Post({
      ...validPostPayload,
      title: `test title`,
      content: `test content`,
      url: `test-title`,
      user: adminRes.body.user._id,
      published: true,
      comments: [],
    });
    const newUnpublishedPost = await new Post({
      ...validPostPayload,
      title: `test title2`,
      content: `test content`,
      url: `test-title2`,
      user: adminRes.body.user._id,
      published: false,
      comments: [],
    });

    const newComment = await new Comment({
      content: "test comment",
      user: adminRes.body.user._id,
      post: newPost._id,
    });
    const savedComment = await newComment.save();
    newPost.comments = [savedComment._id];

    const savedPost = await newPost.save();
    const savedUnpublishedPost = await newUnpublishedPost.save();

    post = savedPost;
    unpublishedPost = savedUnpublishedPost;
  });
  afterEach(async () => {});
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoose.connection.close();
  });

  it("should return 500 if Post.findOne throws error", async () => {
    jest.spyOn(Post, "findOne").mockImplementationOnce(() => {
      throw new Error("test error");
    });

    const res = await request(app).get("/posts/test-title");

    expect(res.statusCode).toEqual(500);
  });

  it("should return 500 if passport.authenticate throws an error when post is unpublished", async () => {
    jest
      .spyOn(passport, "authenticate")
      .mockImplementationOnce((strategy, options, callback) => {
        return () => {
          return callback(new Error("error"), null, null);
        };
      });

    const res = await request(app).get("/posts/test-title2");

    expect(res.statusCode).toEqual(500);
  });

  it("should return 404 if post is not found", async () => {
    const res = await request(app).get("/posts/test-title-3");

    expect(res.statusCode).toEqual(404);
  });

  it("should return 403 if post is not published and user is not an admin", async () => {
    const res = await request(app)
      .get("/posts/test-title2")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toEqual(403);
  });

  it("should return 200 and post object if post is published", async () => {
    const res = await request(app).get("/posts/test-title");

    expect(res.statusCode).toEqual(200);
    expect(res.body.post).not.toBeNull();
  });

  it("should return 200 & post object if post is unpublished and user is admin", async () => {
    const res = await request(app)
      .get("/posts/test-title2")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.post).not.toBeNull();
  });
});
