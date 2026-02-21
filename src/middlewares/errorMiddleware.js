const errorMiddleware = (err, req, res, next) => {
  // console.error("sssssss",err.stack);
  res.status(500).json({ message: err.message });
};

module.exports = errorMiddleware;
