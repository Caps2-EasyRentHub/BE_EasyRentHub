/**
 * Middleware để truyền đối tượng socket.io vào các request
 * @param {Object} io - Socket.io instance
 * @returns {Function} - Middleware function
 */
const socketMiddleware = (io) => (req, res, next) => {
  req.io = io;
  next();
};

export default socketMiddleware;
