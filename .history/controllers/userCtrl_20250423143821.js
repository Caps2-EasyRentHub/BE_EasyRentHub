import Users from "../models/userModel.js";
import Estates from "../models/estateModel.js";
import bcrypt from "bcrypt";

const userCtrl = {
  getUser: async (req, res) => {
    try {
      const user = await Users.findById(req.params.id).select("-password");
      const estates = await Estates.find({ user: req.params.id });
      if (!user) return res.status(400).json({ msg: "User does not exist." });
      res.json({ user, lengthEstates: estates.length });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  
  getAllUsers: async (req, res) => {
    try {
      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "Only Admin users can access this resource"
        });
      }

      const users = await Users.find().select("-password");
      res.json({ users });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  addUser: async (req, res) => {
    try {
      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "Only Admin users can add new users to the system"
        });
      }

      const { full_name, email, password, mobile, role, address, avatar } = req.body;
     
      if (!full_name || !email || !password) {
        return res.status(400).json({
          title: "Missing required fields",
          message: "Full name, email and password are required"
        });
      }
      
    
      const nameRegex = /^[a-zA-Z\sÀ-ỹ]+$/u;
      if (!nameRegex.test(full_name)) {
        return res.status(400).json({
          title: "Invalid name format",
          message: "Full name should not contain special characters or numbers"
        });
      }
      
      
      const emailRegex = /^[^\s@<>()\\/"'`;{}[\]=+&*%]+@[^\s@<>()\\/"'`;{}[\]=+&*%]+\.[^\s@<>()\\/"'`;{}[\]=+&*%]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          title: "Invalid email format",
          message: "Please provide a valid email address without special characters"
        });
      }
      
     
      const hasXssOrInjection = (str) => {
        if (!str) return false;
        // Kiểm tra XSS
        const xssPattern = /<[^>]*script|<[^>]*on\w+\s*=|javascript:|alert\s*\(|eval\s*\(|document\.|window\.|localStorage|sessionStorage/i;
        // Kiểm tra NoSQL Injection
        const noSqlPattern = /\$where|\$ne|\$gt|\$lt|\$regex|\$in|\$exists|\$elemMatch|\$or|\$and|\$not|\$nor|{\s*\$|"[^"]*\$|'[^']*\$/i;
        
        return xssPattern.test(str) || noSqlPattern.test(str);
      };

      if (hasXssOrInjection(full_name) || hasXssOrInjection(email) || 
          hasXssOrInjection(password) || hasXssOrInjection(mobile)) {
        return res.status(400).json({
          title: "Security violation",
          message: "Invalid input detected. Please remove any code or special query syntax"
        });
      }
      if (address) {
        const addressFields = ['name', 'road', 'quarter', 'city', 'country'];
        for (const field of addressFields) {
          if (address[field] && hasXssOrInjection(address[field])) {
            return res.status(400).json({
              title: "Security violation",
              message: `Invalid input detected in address ${field}. Please remove any code or special query syntax`
            });
          }
        }
      }
     
      const existingUser = await Users.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          title: "Email already in use",
          message: "This email address is already registered"
        });
      }
   
      if (role) {
        const validRoles = ["Tenant", "Landlord", "Admin"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            title: "Invalid role",
            message: "Role must be one of: Tenant, Landlord, Admin"
          });
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create new user object
      const newUser = new Users({
        full_name,
        email,
        password: passwordHash,
        role: role || "Tenant",
        status: 1, // Assuming status 1 means active
        mobile: mobile || "",
        avatar: avatar || undefined // Use the default from schema if not provided
      });

      // Add address if provided
      if (address) {
        newUser.address = {
          name: address.name || "",
          road: address.road || "",
          quarter: address.quarter || "",
          city: address.city || "",
          country: address.country || "",
          lat: address.lat || "",
          lng: address.lng || ""
        };
      }

      // Save the new user
      await newUser.save();

      // Return success without sending back the password
      res.status(201).json({
        msg: "User created successfully",
        user: {
          _id: newUser._id,
          full_name: newUser.full_name,
          email: newUser.email,
          role: newUser.role,
          avatar: newUser.avatar,
          mobile: newUser.mobile,
          address: newUser.address,
          status: newUser.status,
          createdAt: newUser.createdAt
        }
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const { fullname, email, phone, avatar, role, password } = req.body;
      
      const user = await Users.findById(req.params.id);
      if (!user) return res.status(404).json({ msg: "User not found" });
      
      if (req.user.role !== "Admin" && req.user._id.toString() !== req.params.id) {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "You don't have permission to edit other users' information"
        });
      }

      // Check if email is being updated and if it's already in use by another user
      if (email && email !== user.email) {
        const emailRegex = /^[^\s@<>()\\/"'`;{}[\]=+&*%]+@[^\s@<>()\\/"'`;{}[\]=+&*%]+\.[^\s@<>()\\/"'`;{}[\]=+&*%]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            title: "Invalid email format",
            message: "Please provide a valid email address without special characters"
          });
        }
        
        const existingUser = await Users.findOne({ email });
        if (existingUser && existingUser._id.toString() !== req.params.id) {
          return res.status(400).json({
            title: "Email already in use",
            message: "This email address is already registered by another user"
          });
        }
      }

      const updateData = {};
      if (fullname) updateData.fullname = fullname;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (avatar) updateData.avatar = avatar;

      if (role && req.user.role === "Admin") {
        const validRoles = ["Tenant", "Admin", "Landlord"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            title: "Invalid role",
            message: "Role must be one of: Tenant, Admin, Landlord"
          });
        }
        updateData.role = role;
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 12);
        updateData.password = passwordHash;
      }

      const updatedUser = await Users.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select("-password");
      
      res.json({ 
        msg: "User information updated successfully",
        user: updatedUser 
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  
  deleteUser: async (req, res) => {
    try {
      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "Only Admin users can delete accounts"
        });
      }

      const user = await Users.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      if (req.user._id.toString() === req.params.id) {
        return res.status(400).json({
          title: "Action not allowed",
          message: "You cannot delete your own account"
        });
      }
 
      if (user.role === "Admin") {
        const adminCount = await Users.countDocuments({ role: "Admin" });
        if (adminCount <= 1) {
          return res.status(400).json({
            title: "Action not allowed",
            message: "Cannot delete the last admin account in the system"
          });
        }
      }
   
      await Users.findByIdAndDelete(req.params.id);
      
      res.json({ 
        msg: "User deleted successfully"
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  }
};

export default userCtrl;