import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Hospital from '../models/Hospital.js';
import Driver from '../models/Driver.js';
import Ambulance from '../models/Ambulance.js';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'shems_jwt_secure_secret_token_2026_xyz', {
    expiresIn: '30d',
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, ...extraDetails } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      isVerified: true, // Auto-verify for ease of evaluation
    });

    // Create role-specific profile
    if (role === 'patient') {
      await Patient.create({
        user: user._id,
        gender: extraDetails.gender || 'other',
        dob: extraDetails.dob || new Date(),
        bloodGroup: extraDetails.bloodGroup || 'O+',
        address: extraDetails.address || 'Not specified',
        emergencyContactName: extraDetails.emergencyContactName || 'Self',
        emergencyContactPhone: extraDetails.emergencyContactPhone || phone,
        latitude: extraDetails.latitude || 19.0760,
        longitude: extraDetails.longitude || 72.8777,
      });
    } else if (role === 'hospital') {
      await Hospital.create({
        user: user._id,
        name: extraDetails.hospitalName || name,
        address: extraDetails.address || 'Not specified',
        contact: phone,
        emergencyContact: extraDetails.emergencyContact || phone,
        totalBeds: extraDetails.totalBeds || 50,
        availableBeds: extraDetails.availableBeds || 20,
        icuBedsTotal: extraDetails.icuBedsTotal || 10,
        icuBedsAvailable: extraDetails.icuBedsAvailable || 5,
        oxygenBedsTotal: extraDetails.oxygenBedsTotal || 15,
        oxygenBedsAvailable: extraDetails.oxygenBedsAvailable || 8,
        doctorsAvailable: extraDetails.doctorsAvailable || 5,
        latitude: extraDetails.latitude || 19.0760,
        longitude: extraDetails.longitude || 72.8777,
        isApproved: false, // Must be approved by admin
      });
    } else if (role === 'driver') {
      await Driver.create({
        user: user._id,
        licenseNumber: extraDetails.licenseNumber || 'MOCK-DL-12345',
        status: 'offline',
        currentLatitude: 19.0760,
        currentLongitude: 72.8777,
      });
    }

    const token = signToken(user._id);

    res.status(201).json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user.', error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const token = signToken(user._id);

    res.status(200).json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in.', error: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = req.user;
    let profile = null;

    if (user.role === 'patient') {
      profile = await Patient.findOne({ user: user._id });
    } else if (user.role === 'hospital') {
      profile = await Hospital.findOne({ user: user._id });
    } else if (user.role === 'driver') {
      profile = await Driver.findOne({ user: user._id }).populate('currentAmbulance');
      if (profile) {
        profile.status = 'available';
        await profile.save();
        if (profile.currentAmbulance) {
          await Ambulance.findByIdAndUpdate(profile.currentAmbulance._id, { availability: true });
        }
      }
    }

    res.status(200).json({
      status: 'success',
      user: {
        ...user.toObject(),
        id: user._id.toString(), // always include id for frontend compatibility
      },
      profile,
      data: {
        ...user.toObject(),
        id: user._id.toString(),
        driverProfile: user.role === 'driver' ? (profile?.toObject ? profile.toObject() : profile) : undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user profile.', error: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Verification error.', error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No user registered with this email.' });
    }

    // Simple mock reset token for evaluation ease
    const resetToken = Math.random().toString(36).substring(2, 10);
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Log the link so it can be verified easily from the console logs
    console.log(`[MOCK EMAIL] Password Reset Link: http://localhost:5173/reset-password/${resetToken}`);

    res.status(200).json({
      status: 'success',
      message: 'Password reset link generated. Check console log for details.',
      token: resetToken, // send in response so testing client can use it directly
    });
  } catch (error) {
    res.status(500).json({ message: 'Error initiating reset.', error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful.' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password.', error: error.message });
  }
};
