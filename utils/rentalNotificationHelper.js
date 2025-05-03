import Notify from "../models/notifyModel.js";

const NOTIFY_TYPES = {
  REQUEST_CREATED: "rental_request_created",
  REQUEST_APPROVED: "rental_request_approved",
  REQUEST_REJECTED: "rental_request_rejected",
  REQUEST_CANCELLED: "rental_request_cancelled",
};

export const createRentalNotification = async (rentalTransaction, type, io) => {
  try {
    console.log("Bắt đầu tạo thông báo:", type);

    if (!rentalTransaction) {
      console.log("Không có dữ liệu rentalTransaction, không tạo thông báo");
      return;
    }

    if (!io) {
      console.log(
        "Không có object io, thông báo sẽ chỉ được lưu trong DB không gửi real-time"
      );
    } else {
      console.log("Object io tồn tại, thông báo sẽ được gửi real-time");
    }

    let notify;
    let recipients = [];
    let text = "";
    let url = "";
    let content = "";

    switch (type) {
      case NOTIFY_TYPES.REQUEST_CREATED:
        recipients = [rentalTransaction.landlord];
        text = "đã gửi yêu cầu thuê nhà";
        url = `/rental-details/${rentalTransaction._id}`;
        content = `${rentalTransaction.estateName}`;
        console.log(
          `Tạo thông báo: Tenant gửi yêu cầu đến landlord ${rentalTransaction.landlord}`
        );
        break;

      default:
        console.log(`Loại thông báo không được hỗ trợ: ${type}`);
        break;
    }

    if (recipients.length === 0) {
      console.log("Không có người nhận, không tạo thông báo");
      return;
    }

    const user =
      type === NOTIFY_TYPES.REQUEST_CREATED
        ? rentalTransaction.tenant
        : rentalTransaction.landlord;

    console.log(
      `User gửi thông báo: ${user}, recipients: ${recipients.join(", ")}`
    );

    const image =
      rentalTransaction.images && rentalTransaction.images.length > 0
        ? rentalTransaction.images[0]
        : "";

    notify = new Notify({
      user,
      recipients,
      url,
      text,
      content,
      image,
    });

    await notify.save();
    console.log(`Thông báo đã được lưu vào database với ID: ${notify._id}`);

    if (io) {
      console.log("Bắt đầu gửi thông báo qua socket");
      try {
        const notifyObject = notify.toJSON
          ? notify.toJSON()
          : notify.toObject
          ? notify.toObject()
          : notify;

        io.emit("createNotify", {
          ...notifyObject,
          user,
          recipients,
          url,
          text,
          content,
          image,
        });
        console.log("Đã emit sự kiện createNotify qua socket");
      } catch (socketErr) {
        console.error("Lỗi khi emit sự kiện socket:", socketErr);
      }
    }

    return notify;
  } catch (err) {
    console.error("Error creating rental notification:", err);
  }
};

export default {
  createRentalNotification,
  NOTIFY_TYPES,
};
