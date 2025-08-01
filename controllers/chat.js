import { ALERT, NEW_MESSAGE, NEW_MESSAGE_ALERT, REFETCH_CHATS } from "../constants/event.js";
import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { deleteFilesFromCloudinary, emitEvent, uploadFilesToCloudinary } from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";

//Creating new Group
const newGroupChat = TryCatch(async (req, res, next) => {
    const { name, members } = req.body;

    const allMembers = [...members, req.userID];
    await Chat.create({
        name,
        groupChat: true,
        creator: req.userID,
        members: allMembers
    })
    emitEvent(req, ALERT, allMembers, { message: `Welcome to ${name} group` });
    emitEvent(req, REFETCH_CHATS, members);
    return res.status(201).json({
        success: true,
        message: "Group created"
    })
})


// Geting all chats of the logged in user
const getMyChats = TryCatch(async (req, res, next) => {
    // req.userID = "6735adeb529fd87bd2ce17f9";
    const chats = await Chat.find({ members: req.userID }).populate(
        "members",
        "name avatar"
    )
    const transformChats = chats.map(({ _id, name, members, groupChat }) => {
        const otherMember = getOtherMember(members, req.userID)

        return {
            _id,
            groupChat,
            avatar:
                groupChat
                    ? members.slice(0, 3).map(({ avatar }) => avatar.url)
                    : [otherMember.avatar.url],
            name: groupChat ? name : otherMember.name,
            members: members.reduce((prev, cur) => {
                if (cur._id.toString() !== req.userID.toString()) {
                    prev.push(cur._id)
                }
                return prev;
            }, []),
        }
    })
    return res.status(200).json({
        success: true,
        chats: transformChats
    })
})


//geting all groups of the logged in user
const getMyGroups = TryCatch(async (req, res, next) => {
    const chats = await Chat.find({
        members: req.userID,
        groupChat: true,
        creator: req.userID
    }).populate("members", "name avatar")

    const groups = chats.map(({ members, _id, groupChat, name }) => (
        {
            _id,
            groupChat,
            name,
            avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
        }
    ));
    return res.status(200).json({
        success: true,
        groups
    })
})

// Adding Members to Group(PUT)
const addMembers = TryCatch(async (req, res, next) => {
    const { chatId, members } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat) {
        return next(new ErrorHandler("Chat Not Found", 404))
    }

    if (!chat.groupChat) {
        return next(new ErrorHandler("This is not a Group", 400))
    }
    if (chat.creator.toString() !== req.userID.toString()) {
        return next(new ErrorHandler("You are not allowed to add members", 403))
    }


    const allNewMembersPromise = members.map((i) => User.findById(i, "name"))

    const allNewMembers = await Promise.all(allNewMembersPromise);

    const uniqueMembers = allNewMembers.filter((i) => !chat.members.includes(i._id.toString())).map((i) => i._id)

    chat.members.push(...uniqueMembers)

    if (chat.members.length > 100) {
        return next(new ErrorHandler("Group members limit reached", 400))
    }

    await chat.save();

    const allUsersName = allNewMembers.map((i) => i.name).join(",");

    emitEvent(
        req,
        ALERT,
        chat.members,
        { message: `${allUsersName} has been added in the group` }
    );

    emitEvent(req, REFETCH_CHATS, chat.members);

    return res.status(200).json({
        success: true,
        message: "Members Added Successfully"
    })
})

// Removing Members to Group(PUT)
const removeMember = TryCatch(async (req, res, next) => {
    const { chatId, userID } = req.body;

    const [chat, userThatWillBeRemoved] = await Promise.all([
        Chat.findById(chatId),
        User.findById(userID)
    ]);

    if (!chat) {
        return next(new ErrorHandler("Chat Not Found", 404))
    }

    if (!chat.groupChat) {
        return next(new ErrorHandler("This is not a group", 400))
    }
    if (chat.creator.toString() !== req.userID.toString()) {
        return next(new ErrorHandler("You are not allowed to remove members", 403))
    }
    if (chat.members.length <= 3) {
        return next(new ErrorHandler("Group must have at least 3 members", 400))
    }

    const allChatMembers = chat.members.map((i) => i.toString())

    chat.members = chat.members.filter((member) => member.toString() !== userID.toString());

    await chat.save();

    emitEvent(
        req,
        ALERT,
        chat.members,
        { message: `${userThatWillBeRemoved.name} has been removed from the group`, chatId }
    )

    emitEvent(req, REFETCH_CHATS, allChatMembers);

    return res.status(200).json({
        success: true,
        message: "Member Removed Successfully"
    })
})

// Leave Group
const leaveGroup = TryCatch(async (req, res, next) => {
    const chatId = req.params.id;

    const chat = await Chat.findById(chatId);

    if (!chat) {
        return next(new ErrorHandler("Chat Not Found", 404))
    }

    if (!chat.groupChat) {
        return next(new ErrorHandler("This is not a group", 400))
    }

    const remainingMembers = chat.members.filter(
        (member) => member.toString() !== req.userID.toString()
    );

    if (remainingMembers.length < 3) {
        return next(new ErrorHandler("Group must have at least 3 members", 400))
    }

    if (chat.creator.toString() === req.userID.toString()) {
        const randomElement = Math.floor(Math.random() * remainingMembers.length)
        const newCreator = remainingMembers[randomElement];
        chat.creator = newCreator;
    }

    chat.members = remainingMembers;

    const [user] = await Promise.all([
        User.findById(req.userID, "name"),
        chat.save()
    ]);

    emitEvent(
        req,
        ALERT,
        chat.members,
        { message: `User ${user.name} has left the group`, chatId }
    );

    return res.status(200).json({
        success: true,
        message: "Group leaved successfully"
    })

})

//send attachments
const sendAttachments = TryCatch(async (req, res, next) => {
    const { chatId } = req.body;
    const files = req.files || [];

    if (files.length < 1) return next(new ErrorHandler("Please Upload  Attachment", 400));
    if (files.length > 5) return next(new ErrorHandler("Files can't be more than 5", 400));

    const [chat, me] = await Promise.all([
        Chat.findById(chatId),
        User.findById(req.userID, "name")
    ]);

    if (!chat) {
        return next(new ErrorHandler("Chat Not Found", 404))
    }

    //uploads file here
    const attachments = await uploadFilesToCloudinary(files);

    const messageForDB = {
        content: " ",
        attachments,
        sender: me._id,
        chat: chatId
    };

    const messageForRealTime = {
        ...messageForDB,
        sender: {
            _id: me._id,
            name: me.name
        }
    };

    const message = await Message.create(messageForDB);

    emitEvent(req, NEW_MESSAGE, chat.members, {
        message: messageForRealTime,
        chatId
    })

    emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

    return res.status(200).json({
        success: true,
        message
    })
});

//Get chat details/rename/delete
const getChatDetails = TryCatch(async (req, res, next) => {
    if (req.query.populate == "true") {
        const chat = await Chat.findById(req.params.id).populate("members", "name avatar").lean();

        if (!chat) {
            return next(new ErrorHandler("Chat Not Found", 404))
        }

        chat.members = chat.members.map(({ _id, name, avatar }) => ({
            _id,
            name,
            avatar: avatar.url
        }));

        return res.status(200).json({
            success: true,
            chat
        })

    } else {
        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return next(new ErrorHandler("Chat Not Found", 404))
        }

        return res.status(200).json({
            success: true,
            chat
        });
    }
});

//Rename GroupChat
const renameGroup = TryCatch(async (req, res, next) => {
    const chatId = req.params.id;
    const { name } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat) {
        return next(new ErrorHandler("Chat Not Found", 404))
    }

    if (!chat.groupChat) {
        return next(new ErrorHandler("This is not a group", 400))
    }

    if (chat.creator.toString() !== req.userID.toString())
        return next(new ErrorHandler("You are not allowed to rename group", 403));

    chat.name = name;

    await chat.save();

    emitEvent(req, REFETCH_CHATS, chat.members);

    return res.status(200).json({
        success: true,
        message: "Group Renamed Successfully"
    })
})

//delete Group
const deleteChat = TryCatch(async (req, res, next) => {
    const chatId = req.params.id;
    const chat = await Chat.findById(chatId);
    if (!chat) {
        return next(new ErrorHandler("Chat Not Found", 404))
    }

    const members = chat.members;

    if (chat.groupChat && chat.creator.toString() !== req.userID.toString())
        return next(new ErrorHandler("You are not allowed to delete group", 403));

    if (chat.groupChat && !chat.members.includes(req.userID.toString())) {
        return next(new ErrorHandler("You are not allowed to delete group", 403));
    }

    //Here we have to delete all the messages & attachments or file from the cloudinary of the chat
    const messagesWithAttachments = await Message.find({
        chat: chatId,
        attachments: { $exists: true, $ne: [] },
    })

    const public_ids = [];
    messagesWithAttachments.forEach(({ attachments }) =>
        attachments.forEach(({ public_id }) => public_ids.push(public_id))
    );

    await Promise.all([
        //Delete files from cloudinary
        deleteFilesFromCloudinary(public_ids),
        chat.deleteOne(),
        Message.deleteMany({ chat: chatId })
    ]);

    emitEvent(req, REFETCH_CHATS, members);

    return res.status(200).json({
        success: true,
        message: "Chat Deleted Successfully"
    })
});

//get messages
const getMessages = TryCatch(async (req, res, next) => {
    const chatId = req.params.id;
    const { page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [messages, totalMessagesCount] = await Promise.all([Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip((skip))
        .limit(limit)
        .populate("sender", "name")
        .lean(), Message.countDocuments({ chat: chatId })
    ]);

    const chat = await Chat.findById(chatId);
    if (!chat) return next(new ErrorHandler("Chat not found", 404))

    if (!chat.members.includes(req.userID.toString())) {
        return next(new ErrorHandler("You are not allowed to access this chat", 403))
    }

    const totalPages = Math.ceil(totalMessagesCount / limit) || 0;
    return res.status(200).json({
        success: true,
        messages: messages.reverse(),
        totalPages
    })

})



export { addMembers, deleteChat, getChatDetails, getMessages, getMyChats, getMyGroups, leaveGroup, newGroupChat, removeMember, renameGroup, sendAttachments };

