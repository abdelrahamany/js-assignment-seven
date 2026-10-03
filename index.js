// npm i express mongoose bcrypt
// ======================== index.js ========================
const express = require("express");
const connectDB = require("./DB/connection");
const userRouter = require("./modules/users/user.routes");
const noteRouter = require("./modules/notes/note.routes");

const app = express();
app.use(express.json());
connectDB();

app.use("/users", userRouter);
app.use("/notes", noteRouter);

app.listen(3000, () => console.log("Server running on port 3000"));

// ======================== DB/connection.js ========================
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/stickyNotes");
        console.log("DB connected");
    } catch (err) {
        console.log("DB error", err.message);
    }
    };
    module.exports = connectDB;

    // ======================== utils/handler.js ========================
    module.exports = (fn) => (req, res) =>
    fn(req, res).catch((e) =>
        res.status(e.name === "ValidationError" ? 400 : 500).json({ message: e.message })
    );

    // ======================== DB/models/user.model.js ========================
    const mongoose = require("mongoose");

    const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    age: { type: Number, min: 18, max: 60 },
    });

    module.exports = mongoose.model("User", userSchema);

    // ======================== DB/models/note.model.js ========================
    const mongoose = require("mongoose");

    const noteSchema = new mongoose.Schema(
    {
        title: {
        type: String,
        required: true,
        validate: {
            validator: (v) => v !== v.toUpperCase(),
            message: "Title must not be entirely uppercase",
        },
        },
        content: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
    );

    module.exports = mongoose.model("Note", noteSchema);

    // ======================== modules/users/user.controller.js ========================
    const bcrypt = require("bcrypt");
    const User = require("../../DB/models/user.model");
    const handler = require("../../utils/handler");

    exports.signup = handler(async (req, res) => {
    const { name, email, password, phone, age } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already exists." });
    const hashed = bcrypt.hashSync(password, 10);
    await User.create({ name, email, password: hashed, phone, age });
    res.status(201).json({ message: "User added successfully." });
    });

    exports.login = handler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password))
        return res.status(401).json({ message: "Invalid email or password" });
    res.json({ message: "Logged in", userId: user._id });
    });

    exports.updateUser = handler(async (req, res) => {
    const { id } = req.params;
    const { name, email, age, phone } = req.body; // password is not allowed
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (email && email !== user.email) {
        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ message: "Email already exists." });
    }
    await User.updateOne(
        { _id: id },
        { name, email, age, phone },
        { runValidators: true }
    );
    res.json({ message: "User updated" });
    });

    exports.deleteUser = handler(async (req, res) => {
    const user = await User.findByIdAndDelete(req.query.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
    });

    exports.getUser = handler(async (req, res) => {
    const user = await User.findById(req.query.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
    });

    // ======================== modules/users/user.routes.js ========================
    const router = require("express").Router();
    const c = require("./user.controller");

    router.post("/signup", c.signup);
    router.post("/login", c.login);
    router.patch("/:id", c.updateUser);
    router.delete("/", c.deleteUser);
    router.get("/", c.getUser);

    module.exports = router;

    // ======================== modules/notes/note.controller.js ========================
    const mongoose = require("mongoose");
    const Note = require("../../DB/models/note.model");
    const handler = require("../../utils/handler");

    // 1. Create note
    exports.createNote = handler(async (req, res) => {
    const { title, content } = req.body;
    await Note.create({ title, content, userId: req.query.userId });
    res.status(201).json({ message: "Note created" });
    });

    // 2. Update single note (owner only)
    exports.updateNote = handler(async (req, res) => {
    const note = await Note.findById(req.params.noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.query.userId)
        return res.status(403).json({ message: "You are not the owner" });
    const { title, content } = req.body;
    const updated = await Note.findByIdAndUpdate(
        req.params.noteId,
        { title, content },
        { new: true, runValidators: true }
    );
    res.json({ message: "updated", note: updated });
    });

    // 3. Replace note (owner only)
    exports.replaceNote = handler(async (req, res) => {
    const note = await Note.findById(req.params.noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.query.userId)
        return res.status(403).json({ message: "You are not the owner" });
    const replaced = await Note.findOneAndReplace(
        { _id: req.params.noteId },
        req.body,
        { new: true, runValidators: true }
    );
    res.json(replaced);
    });

    // 4. Update title of all notes of logged-in user
    exports.updateAllNotes = handler(async (req, res) => {
    const result = await Note.updateMany(
        { userId: req.query.userId },
        { title: req.body.title }
    );
    if (result.matchedCount === 0)
        return res.status(404).json({ message: "No note found" });
    res.json({ message: "All notes updated" });
    });

    // 5. Delete single note (owner only)
    exports.deleteNote = handler(async (req, res) => {
    const note = await Note.findById(req.params.noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.query.userId)
        return res.status(403).json({ message: "You are not the owner" });
    await Note.deleteOne({ _id: req.params.noteId });
    res.json({ message: "deleted", note });
    });

    // 6. Paginate + sort by createdAt desc
    exports.paginateSort = handler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const notes = await Note.find({ userId: req.query.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
    res.json(notes);
    });

    // 7. Get note by id (owner only)
    exports.getNoteById = handler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.userId.toString() !== req.query.userId)
        return res.status(403).json({ message: "You are not the owner" });
    res.json(note);
    });

    // 8. Get note by content
    exports.getByContent = handler(async (req, res) => {
    const note = await Note.findOne({
        userId: req.query.userId,
        content: req.query.content,
    });
    if (!note) return res.status(404).json({ message: "No note found" });
    res.json(note);
    });

    // 9. Notes with user info
    exports.noteWithUser = handler(async (req, res) => {
    const notes = await Note.find({ userId: req.query.userId })
        .select("title userId createdAt")
        .populate("userId", "email -_id");
    res.json(notes);
    });

    // 10. Aggregation + search by title
    exports.aggregateNotes = handler(async (req, res) => {
    const match = { userId: new mongoose.Types.ObjectId(req.query.userId) };
    if (req.query.title) match.title = req.query.title;
    const notes = await Note.aggregate([
    { $match: match },
    {
        $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        },
    },
    { $unwind: "$user" },
    {
        $project: {
        title: 1,
        userId: 1,
        createdAt: 1,
        "user.name": 1,
        "user.email": 1,
        },
    },
    ]);
    res.json(notes);
    });

    // 11. Delete all notes of logged-in user
    exports.deleteAllNotes = handler(async (req, res) => {
    await Note.deleteMany({ userId: req.query.userId });
    res.json({ message: "Deleted" });
});

// ======================== modules/notes/note.routes.js ========================
const Router = require("express").Router();
const c = require("./note.controller");

router.post("/", c.createNote);
router.patch("/all", c.updateAllNotes);
router.get("/paginate-sort", c.paginateSort);
router.get("/note-by-content", c.getByContent);
router.get("/note-with-user", c.noteWithUser);
router.get("/aggregate", c.aggregateNotes);
router.put("/replace/:noteId", c.replaceNote);
router.delete("/", c.deleteAllNotes);
router.patch("/:noteId", c.updateNote);
router.delete("/:noteId", c.deleteNote);
router.get("/:id", c.getNoteById); 

module.exports = router;

// ======================== bonus.js ========================
var longestCommonPrefix = function (strs) {
    if (!strs.length) return "";
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
        while (strs[i].indexOf(prefix) !== 0) {
        prefix = prefix.slice(0, -1);
        if (prefix === "") return "";
        }
    }
    return prefix;
};