import express from "express"
import { acceptFriendRequest, getMyFriends, getMyNotifications, getMyProfile, login, logout, newUser, searchUser, sendFriendRequest } from "../controllers/user.js";
import { singleAvatar } from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { acceptRequestValidator, loginValidator, registerValidator, sendRequestValidator, validateHandler } from "../lib/validators.js";

const app = express.Router();


app.post("/new", singleAvatar, registerValidator(), validateHandler, newUser)
app.post("/login", loginValidator(), validateHandler, login)


//User Must be login to access below route
app.use(isAuthenticated)

app.get("/me", getMyProfile)
app.get("/logout", logout)
app.get("/search", searchUser)
app.put("/send-request", sendRequestValidator(), validateHandler, sendFriendRequest)
app.put("/accept-request", acceptRequestValidator(), validateHandler, acceptFriendRequest)
app.get("/notifications", getMyNotifications)
app.get("/friends", getMyFriends)


export default app;