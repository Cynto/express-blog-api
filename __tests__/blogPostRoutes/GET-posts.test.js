const index = require("../../routes/index.js");
var cookieParser = require("cookie-parser");
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const passport = require("passport");
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

describe("GET /posts", () => {
  let userToken;
  let adminToken;
  let posts = [];
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

    let userRes = await request(app).post("/users/login").send(userPayload);
    userToken = userRes.body.token;

    let adminRes = await request(app).post("/users/login").send(adminPayload);
    adminToken = adminRes.body.token;

    for (let i = 0; i <= 40; i++) {
      const newPost = await new Post({
        ...validPostPayload,
        title: `test title ${i}`,
        content: `test content ${i}`,
        url: `test-title-${i}`,
        user: adminRes.body.user._id,
        published: i % 2 === 0,
        comments: [],
      });
      if (i === 3) {
        const newComment = await new Comment({
          content: "test comment",
          user: adminRes.body.user._id,
          post: newPost._id,
        });
        const savedComment = await newComment.save();
        newPost.comments = [savedComment._id];
      }

      const savedPost = await newPost.save();
      posts.push(savedPost);
    }
  });
  afterEach(async () => {});
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoose.connection.close();
  });

  it("should return 500 if passport.authenticate throws an error", async () => {
    jest
      .spyOn(passport, "authenticate")
      .mockImplementationOnce((strategy, options, callback) => {
        return () => {
          return callback(new Error("error"), null, null);
        };
      });

    const res = await request(app).get("/posts");

    expect(res.statusCode).toEqual(500);
  });

  it("should not return unpublished posts if user is not an admin", async () => {
    const res = await request(app)
      .get("/posts")
      .set({
        Authorization: `Bearer ${userToken}`,
        allposts: "true",
      });

    expect(res.body.length).toEqual(12);

    res.body.forEach((post) => {
      expect(post.published).toEqual(true);
    });
  });

  it("should return 12 posts if limit is not specified", async () => {
    const res = await request(app).get("/posts");

    expect(res.body.length).toEqual(12);
  });

  it("should return 15 posts if limit is set to 15", async () => {
    const res = await request(app).get("/posts?limit=15").set({
      allposts: "true",
      limit: "15",
    });

    expect(res.body.length).toEqual(15);
  });

  it("should return 40 posts, if user is admin and all posts is set to true and limit is set to 40", async () => {
    const res = await request(app)
      .get("/posts")
      .set({
        Authorization: `Bearer ${adminToken}`,
        allposts: "true",
        limit: "40",
      });

    expect(res.body.length).toEqual(40);
  });

  it("should return posts sorted by createdAt in descending order", async () => {
    const res = await request(app).get("/posts");

    const sortedPosts = posts.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    expect(res.body[0]._id).toEqual(sortedPosts[0]._id.toString());
  });

  it("should return posts sorted by createdAt in ascending order", async () => {
    const res = await request(app)
      .get("/posts?sort=createdAt")
      .set("sort", "createdAt");

    const sortedPosts = posts.sort((a, b) => {
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    expect(res.body[0]._id).toEqual(sortedPosts[0]._id.toString());
  });

  it("should return posts sorted by comment count in descending order", async () => {
    const res = await request(app)
      .get("/posts?sort=commentCount")
      .set({
        Authorization: `Bearer ${adminToken}`,
        sort: "commentCount",
        allposts: true,
      });

    const sortedPosts = posts.sort((a, b) => {
      return b.comments.length - a.comments.length;
    });

    expect(res.body[0]._id).toEqual(sortedPosts[0]._id.toString());
  });

  it("should return 500 if Post.aggregate callback returns error", async () => {
    jest.spyOn(Post, "aggregate").mockImplementationOnce((agg, callback) => {
      callback(new Error("test error"), null);
    });

    const res = await request(app).get("/posts");

    expect(res.statusCode).toEqual(500);
  });
});
