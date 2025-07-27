import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { addMembers, getMyChats, getMyGroups, newGroupChat, removeMember, leaveGroup, sendAttachments, getChatDetails, renameGroup, deleteChat, getMessages } from "../controllers/chat.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import { addMemberValidator, chatIdValidator, newGroupValidator, removeMemberValidator, renameGroupValidator, sendAttachmentsValidator, validateHandler } from "../lib/validators.js";

const app = express.Router();


//User Must be login to access below route
app.use(isAuthenticated);

app.post("/new", newGroupValidator(), validateHandler, newGroupChat)
app.get("/my", getMyChats)
app.get("/my/groups", getMyGroups)
app.put("/add-members", addMemberValidator(), validateHandler, addMembers)
app.put("/remove-member", removeMemberValidator(), validateHandler, removeMember)
app.delete("/leave/:id", chatIdValidator(), validateHandler, leaveGroup);

//send attachments
app.post("/message", attachmentsMulter, sendAttachmentsValidator(), validateHandler, sendAttachments);

//get Messages
app.get("/messages/:id", chatIdValidator(), validateHandler, getMessages);

//get chat details,rename,delete
app.route("/:id")
    .get(chatIdValidator(), validateHandler, getChatDetails)
    .put(renameGroupValidator(), validateHandler, renameGroup)
    .delete(chatIdValidator(), validateHandler, deleteChat);

export default app;