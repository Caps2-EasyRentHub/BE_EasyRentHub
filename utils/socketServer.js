import Notify from "../models/notifyModel.js";

let userMap = new Map();
let userSocketsMap = new Map();

export const SocketServer = (io) => {
  console.log("Socket.IO server đã được khởi tạo");

  io.on("connection", (socket) => {
    console.log(`Client đã kết nối với socket ID: ${socket.id}`);

    // Khi user kết nối
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

      // Gửi danh sách user đang online cho tất cả clients
      io.emit("onlineUsers", Array.from(userSocketsMap.keys()));

      // Gửi thông báo chưa đọc cho người dùng mới kết nối
      sendUnreadNotifications(userId, socket);
    });

    // Disconnect
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

    // Tạo thông báo mới
    socket.on("createNotify", async (msg) => {
      console.log("Nhận sự kiện createNotify:", JSON.stringify(msg));

      try {
        const { id, recipients, text, content, url, user, image } = msg;

        if (recipients.length === 0) return;

        // Tạo thông báo mới trong database
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

        // Gửi thông báo đến các người dùng đang online
        for (const recipient of recipients) {
          if (userSocketsMap.has(recipient)) {
            const recipientSockets = userSocketsMap.get(recipient);

            // Gửi thông báo đến tất cả các thiết bị của người nhận
            recipientSockets.forEach((socketId) => {
              io.to(socketId).emit("getNotify", notify);
            });
          }
        }
      } catch (err) {
        console.error("Socket error in createNotify:", err);
      }
    });

    // Xóa thông báo
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

        // Thông báo cho tất cả người nhận đang online về việc xóa thông báo
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

    // Lấy danh sách thông báo
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

    // Đánh dấu đã đọc thông báo
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

          // Thông báo cập nhật trạng thái cho người dùng
          const userId = userMap.get(socket.id);
          if (userId) {
            // Gửi lại cho tất cả các thiết bị của người dùng hiện tại
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

    // Xóa tất cả thông báo
    socket.on("deleteAllNotifies", async (userId) => {
      console.log(`Nhận yêu cầu deleteAllNotifies từ người dùng: ${userId}`);

      try {
        if (!userId) return;

        await Notify.deleteMany({ recipients: userId });

        // Thông báo đã xóa tất cả thông báo cho người dùng
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

// Hàm gửi thông báo chưa đọc cho người dùng mới kết nối
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
