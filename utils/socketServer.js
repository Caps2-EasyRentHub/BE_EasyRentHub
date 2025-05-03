import Notify from "../models/notifyModel.js";

let userMap = new Map();
let userSocketsMap = new Map();

export const SocketServer = (io) => {
  console.log("Socket.IO server đã được khởi tạo");

  io.on("connection", (socket) => {
    console.log(`Client đã kết nối với socket ID: ${socket.id}`);

    socket.on("join", (userId) => {
      if (!userId) {
        console.log("User ID không hợp lệ, không thể kết nối");
        return;
      }

      console.log(`User ${userId} đã tham gia với socket ID: ${socket.id}`);

      userMap.set(socket.id, userId);

      if (!userSocketsMap.has(userId)) {
        userSocketsMap.set(userId, new Set());
      }
      userSocketsMap.get(userId).add(socket.id);

      console.log(
        `Số lượng người dùng online hiện tại: ${userSocketsMap.size}`
      );

      io.emit("onlineUsers", Array.from(userSocketsMap.keys()));

      sendUnreadNotifications(userId, socket);
    });

    socket.on("disconnect", () => {
      console.log(`Client ngắt kết nối: ${socket.id}`);

      const userId = userMap.get(socket.id);
      if (userId) {
        console.log(`User ${userId} đã ngắt kết nối`);

        if (userSocketsMap.has(userId)) {
          const userSockets = userSocketsMap.get(userId);
          userSockets.delete(socket.id);

          if (userSockets.size === 0) {
            userSocketsMap.delete(userId);
          }
        }

        userMap.delete(socket.id);
      }

      console.log(`Số lượng người dùng online còn lại: ${userSocketsMap.size}`);

      io.emit("onlineUsers", Array.from(userSocketsMap.keys()));
    });

    socket.on("createNotify", async (msg) => {
      console.log("Nhận sự kiện createNotify:", JSON.stringify(msg));

      try {
        const { id, recipients, text, content, url, user, image } = msg;

        if (recipients.length === 0) return;

        const notify = new Notify({
          id,
          recipients,
          url,
          text,
          content,
          image,
          user,
        });

        await notify.save();

        for (const recipient of recipients) {
          if (userSocketsMap.has(recipient)) {
            const recipientSockets = userSocketsMap.get(recipient);

            recipientSockets.forEach((socketId) => {
              io.to(socketId).emit("getNotify", notify);
            });
          }
        }
      } catch (err) {
        console.error("Socket error in createNotify:", err);
      }
    });

    socket.on("removeNotify", async (msg) => {
      console.log("Nhận sự kiện removeNotify:", JSON.stringify(msg));

      try {
        const notify = await Notify.findOneAndDelete({
          _id: msg.id,
          url: msg.url,
        });

        if (!notify) {
          console.log("Không tìm thấy thông báo để xóa");
          return;
        }

        console.log(`Đã xóa thông báo: ${notify._id}`);

        for (const recipient of notify.recipients) {
          if (userSocketsMap.has(recipient.toString())) {
            const recipientSockets = userSocketsMap.get(recipient.toString());

            recipientSockets.forEach((socketId) => {
              io.to(socketId).emit("removeNotify", notify);
            });
          }
        }
      } catch (err) {
        console.error("Lỗi socket trong removeNotify:", err);
      }
    });

    socket.on("getNotifies", async (userId) => {
      console.log(`Nhận yêu cầu getNotifies từ người dùng: ${userId}`);

      try {
        if (!userId) return;

        const notifies = await Notify.find({ recipients: userId })
          .sort("-createdAt")
          .populate("user", "avatar full_name");

        socket.emit("getNotifies", notifies);
      } catch (err) {
        console.error("Lỗi trong getNotifies:", err);
      }
    });

    socket.on("isReadNotify", async (msg) => {
      console.log("Nhận sự kiện isReadNotify:", JSON.stringify(msg));

      try {
        const updated = await Notify.findOneAndUpdate(
          { _id: msg.id },
          { isRead: true },
          { new: true }
        );

        if (updated) {
          console.log(`Thông báo ${msg.id} đã được đánh dấu là đã đọc`);

          const userId = userMap.get(socket.id);
          if (userId) {
            if (userSocketsMap.has(userId)) {
              const userSockets = userSocketsMap.get(userId);
              userSockets.forEach((socketId) => {
                io.to(socketId).emit("notifyUpdated", updated);
              });
            }
          }
        }
      } catch (err) {
        console.error("Lỗi socket trong isReadNotify:", err);
      }
    });

    socket.on("deleteAllNotifies", async (userId) => {
      console.log(`Nhận yêu cầu deleteAllNotifies từ người dùng: ${userId}`);

      try {
        if (!userId) return;

        await Notify.deleteMany({ recipients: userId });

        if (userSocketsMap.has(userId)) {
          const userSockets = userSocketsMap.get(userId);
          userSockets.forEach((socketId) => {
            io.to(socketId).emit("allNotifiesDeleted");
          });
        }
      } catch (err) {
        console.error("Lỗi trong deleteAllNotifies:", err);
      }
    });
  });
};

const sendUnreadNotifications = async (userId, socket) => {
  try {
    const notifies = await Notify.find({
      recipients: userId,
      isRead: false,
    })
      .sort("-createdAt")
      .populate("user", "avatar full_name");

    if (notifies.length > 0) {
      socket.emit("getNotifies", notifies);
    }
  } catch (err) {
    console.error("Lỗi khi gửi thông báo chưa đọc:", err);
  }
};
