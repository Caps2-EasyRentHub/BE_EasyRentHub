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

  // Validate phone number function
  validatePhoneNumber: (phone) => {
    if (!phone) return { valid: true }; // Phone is optional
    
    // Remove all non-digit characters for proper validation
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Vietnamese phone validation
    // Format: +84xxxxxxxxx or 0xxxxxxxxx where x are digits
    // Length: 10 digits (excluding country code)
    const isVietnamesePhone = () => {
      // Vietnamese phones: either start with 0 and have 10 digits, or start with 84 and have total 11-12 digits
      if (phone.startsWith('0') && cleanPhone.length === 10) return true;
      if ((phone.startsWith('+84') || phone.startsWith('84')) && 
          (cleanPhone.length === 11 || cleanPhone.length === 12)) return true;
      return false;
    };

    // General international phone validation
    // Must contain only digits, +, -, spaces, and parentheses
    // Length: between 7 and 15 digits (excluding formatting characters)
    const isValidInternationalFormat = /^[0-9+\-\s()]+$/.test(phone);
    const isValidDigitCount = cleanPhone.length >= 7 && cleanPhone.length <= 15;
    
    // Check if it's either a valid Vietnamese phone or a valid international format
    if (isVietnamesePhone() || (isValidInternationalFormat && isValidDigitCount)) {
      return { valid: true };
    } else if (!isValidInternationalFormat) {
      return { 
        valid: false, 
        message: "Phone number can only contain digits, +, -, spaces, and parentheses"
      };
    } else if (!isValidDigitCount) {
      return { 
        valid: false, 
        message: "Phone number must be between 7 and 15 digits"
      };
    } else if (!isVietnamesePhone() && phone.includes('0') || phone.includes('84')) {
      return { 
        valid: false, 
        message: "Vietnamese phone numbers must be in format 0xxxxxxxxx or +84xxxxxxxxx with 10 digits"
      };
    } else {
      return { 
        valid: false, 
        message: "Invalid phone number format" 
      };
    }
  },

  // Function to validate address fields
  validateAddressField: (field, value) => {
    if (!value) return { valid: true }; // Empty fields are acceptable

    // Address validation regex - allow alphanumeric characters, spaces, and common address-specific characters
    // This allows letters, numbers, spaces, commas, periods, hyphens, slashes, and specific character sets for Vietnamese
    const addressRegex = /^[a-zA-Z0-9\s,.'\-\/()&#À-ỹ]+$/u;
    
    if (!addressRegex.test(value)) {
      return {
        valid: false,
        message: `Address ${field} contains invalid characters. Only letters, numbers, and basic punctuation are allowed.`
      };
    }
    
    return { valid: true };
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
      
      // Validate name format
      const nameRegex = /^[a-zA-Z\sÀ-ỹ]+$/u;
      if (!nameRegex.test(full_name)) {
        return res.status(400).json({
          title: "Invalid name format",
          message: "Full name should not contain special characters or numbers"
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@<>()\\/"'`;{}[\]=+&*%]+@[^\s@<>()\\/"'`;{}[\]=+&*%]+\.[^\s@<>()\\/"'`;{}[\]=+&*%]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          title: "Invalid email format",
          message: "Please provide a valid email address without special characters"
        });
      }

      // Validate phone number if provided
      if (mobile) {
        const phoneValidation = userCtrl.validatePhoneNumber(mobile);
        if (!phoneValidation.valid) {
          return res.status(400).json({
            title: "Invalid phone number",
            message: phoneValidation.message
          });
        }
      }
      
      // Validate address fields if provided
      if (address) {
        const addressFields = ['name', 'road', 'quarter', 'city', 'country'];
        for (const field of addressFields) {
          if (address[field]) {
            const fieldValidation = userCtrl.validateAddressField(field, address[field]);
            if (!fieldValidation.valid) {
              return res.status(400).json({
                title: "Invalid address format",
                message: fieldValidation.message
              });
            }
          }
        }
      }
      
      // Security checks
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
     
      // Check if email already exists
      const existingUser = await Users.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          title: "Email already in use",
          message: "This email address is already registered"
        });
      }
   
      // Validate role if provided
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
      const { fullname, email, phone, avatar, role, password, address } = req.body;
      
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

      // Validate phone number if provided
      if (phone) {
        const phoneValidation = userCtrl.validatePhoneNumber(phone);
        if (!phoneValidation.valid) {
          return res.status(400).json({
            title: "Invalid phone number",
            message: phoneValidation.message
          });
        }
      }

      // Validate address fields if provided
      if (address) {
        const addressFields = ['name', 'road', 'quarter', 'city', 'country'];
        for (const field of addressFields) {
          if (address[field]) {
            const fieldValidation = userCtrl.validateAddressField(field, address[field]);
            if (!fieldValidation.valid) {
              return res.status(400).json({
                title: "Invalid address format",
                message: fieldValidation.message
              });
            }
          }
        }
      }

      const updateData = {};
      if (fullname) updateData.fullname = fullname;
      if (email) updateData.email = email;
      if (phone) updateData.mobile = phone; // Note: field name corrected from phone to mobile to match schema
      if (avatar) updateData.avatar = avatar;

      // Update address if provided
      if (address) {
        updateData.address = {
          ...user.address, // Preserve existing address fields if not being updated
          ...(address.name && { name: address.name }),
          ...(address.road && { road: address.road }),
          ...(address.quarter && { quarter: address.quarter }),
          ...(address.city && { city: address.city }),
          ...(address.country && { country: address.country }),
          ...(address.lat && { lat: address.lat }),
          ...(address.lng && { lng: address.lng })
        };
      }

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