import FavoriteRoom from "../models/favoriteModel.js";

export const getFavoriteRooms = async (req, res) => {
  try {
    const userId = req.params.userId;
    const favorite = await FavoriteRoom.findOne({ user: userId }).populate(
      "rooms"
    );

    if (!favorite) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy danh sách yêu thích" });
    }

    if (favorite.rooms.length === 0) {
      return res.status(404).json({ message: "Không có phòng yêu thích nào" });
    }

    res.status(200).json(favorite.rooms);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách phòng yêu thích", error });
  }
};

export const addFavoriteRoom = async (req, res) => {
  try {
    const { userId, roomId } = req.body;

    let favorite = await FavoriteRoom.findOne({ user: userId });

    if (!favorite) {
      favorite = new FavoriteRoom({ user: userId, rooms: [roomId] });
    } else {
      if (!favorite.rooms.includes(roomId)) {
        favorite.rooms.push(roomId);
      } else {
        return res
          .status(400)
          .json({ message: "Phòng đã có trong danh sách yêu thích" });
      }
    }

    await favorite.save();
    res
      .status(201)
      .json({ message: "Đã thêm vào danh sách yêu thích", favorite });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi thêm phòng vào yêu thích", error });
  }
};

export const removeFavoriteRoom = async (req, res) => {
  try {
    const { userId, roomId } = req.body;
    const favorite = await FavoriteRoom.findOne({ user: userId });

    if (!favorite) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy danh sách yêu thích của người dùng" });
    }

    if (!favorite.rooms.includes(roomId)) {
      return res
        .status(404)
        .json({
          message: "Phòng không có trong danh sách yêu thích của người dùng",
        });
    }

    favorite.rooms = favorite.rooms.filter((id) => id.toString() !== roomId);
    await favorite.save();

    res
      .status(200)
      .json({ message: "Đã xóa phòng khỏi danh sách yêu thích", favorite });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi xóa phòng khỏi danh sách yêu thích", error });
  }
};
