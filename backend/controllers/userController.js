import validator from "validator";
import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import razorpay from "razorpay";

// Initialize Razorpay instance with error handling
let razorpayInstance;
try {
    console.log("=== Initializing Razorpay ===");
    console.log("Key ID:", process.env.RAZORPAY_KEY_ID);
    console.log("Key Secret present:", !!process.env.RAZORPAY_KEY_SECRET);
    
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay credentials not found in environment variables");
    }

    if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
        throw new Error("Invalid Razorpay key ID. Must use test key for development");
    }
    
    razorpayInstance = new razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log("Razorpay initialized successfully");
} catch (error) {
    console.error("=== Razorpay Initialization Error ===");
    console.error("Error message:", error.message);
    console.error("Full error:", error);
}

//api to register users
const registerUser = async (req, res) => {
    try {

        const { name, email, password } = req.body;

        if (!name || !password || !email) {
            return res.json({ success: false, message: "Missing Details" });
        }

        //validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Enter a valid email" });
        }

        //validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Enter a strong password" });
        }

        //hasing user password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            name,
            email,
            password: hashedPassword
        }

        const newUser = new userModel(userData);
        const user = await newUser.save();

        //_id
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.json({ success: true, token });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

//API for user login
const loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
            res.json({ success: true, token });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

//API to get user profile data
const getProfile = async (req, res) => {
    try {

        const { userId } = req.body;
        const userData = await userModel.findById(userId).select("-password");

        res.json({ success: true, userData });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// API to update user profile
const updateProfile = async (req, res) => {
    try {

        const { userId, name, phone, address, dob, gender } = req.body;
        const imageFile = req.file;

        //console.log("Body:", req.body);
        //console.log("File:", req.file);

        if (!userId || !name || !phone || !dob || !gender) {
            return res.json({
                success: false,
                message: `Missing data. Received - name: ${name}, phone: ${phone}, dob: ${dob}, gender: ${gender}, userId: ${userId}`
            });
        }

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" });
        }

        // Parse address if provided
        const parsedAddress = address ? JSON.parse(address) : {};

        await userModel.findByIdAndUpdate(userId, { name, phone, address: parsedAddress, dob, gender });
        //address: JSON.parse(address)

        if (imageFile) {

            //upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
            const imageURL = imageUpload.secure_url;

            await userModel.findByIdAndUpdate(userId, { image: imageURL });

        }

        res.json({ success: true, message: "Profile Updated" })

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// API to book appointment
const bookAppointment = async (req, res) => {
    try {

        const { userId, docId, slotDate, slotTime } = req.body;

        const docData = await doctorModel.findById(docId).select('-password');

        if (!docData.available) {
            return res.json({ success: false, message: "Doctor not available" });
        }

        let slots_booked = docData.slots_booked;

        //checking sor slots availability
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: "Slot not available" });
            } else {
                slots_booked[slotDate].push(slotTime);
            }
        } else {
            slots_booked[slotDate] = [];
            slots_booked[slotDate].push(slotTime);
        }

        const userData = await userModel.findById(userId).select('-password');

        delete docData.slots_booked;

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData);
        await newAppointment.save();

        //Save new slots data in docData
        await doctorModel.findByIdAndUpdate(docId, { slots_booked });

        res.json({ success: true, message: "Appointment Booked" });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

//API to get user appointments for frontend my-appointments page
const listAppointmnet = async (req, res) => {

    try {

        const { userId } = req.body;
        const appointments = await appointmentModel.find({ userId });

        res.json({ success: true, appointments });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

//API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body;

        const appointmentData = await appointmentModel.findById(appointmentId);
        if (!appointmentData) {
            return res.json({ success: false, message: "Appointment not found" });
        }

        //Verify appointment user
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: "Unauthorized action" });
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true });

        //Releasing doctor slot
        const { docId, slotDate, slotTime } = appointmentData;

        const doctorData = await doctorModel.findById(docId);

        let slots_booked = doctorData.slots_booked || {};

        if (!doctorData || !doctorData.slots_booked) {
            return res.json({ success: false, message: "Doctor data is invalid" });
        }

        //slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime);
        if (slots_booked[slotDate]) {
            slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime);
        }


        await doctorModel.findByIdAndUpdate(docId, { slots_booked });

        res.json({ success: true, message: "Appointmnet cancelled" });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

//API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    console.log("=== Payment Initiation Request ===");
    console.log("Request body:", req.body);
    
    try {
        if (!razorpayInstance) {
            console.error("Razorpay instance not initialized");
            return res.status(500).json({ 
                success: false, 
                message: "Payment gateway not initialized" 
            });
        }

        const { appointmentId } = req.body;
        console.log("Creating payment for appointment:", appointmentId);

        const appointmentData = await appointmentModel.findById(appointmentId);
        console.log("Appointment data:", appointmentData);

        if (!appointmentData) {
            console.error("Appointment not found:", appointmentId);
            return res.status(404).json({ 
                success: false, 
                message: "Appointment not found" 
            });
        }

        if (appointmentData.cancelled) {
            console.error("Appointment is cancelled:", appointmentId);
            return res.status(400).json({ 
                success: false, 
                message: "Cannot process payment for cancelled appointment" 
            });
        }

        if (appointmentData.payment) {
            console.error("Payment already completed for appointment:", appointmentId);
            return res.status(400).json({ 
                success: false, 
                message: "Payment already completed" 
            });
        }

        // Validate amount
        if (!appointmentData.amount || appointmentData.amount <= 0) {
            console.error("Invalid amount:", appointmentData.amount);
            return res.status(400).json({ 
                success: false, 
                message: "Invalid appointment amount" 
            });
        }

        //creating options for razorpay payment
        const options = {
            amount: Math.round(appointmentData.amount * 100), // Convert to paise and ensure it's an integer
            currency: process.env.CURRENCY || 'INR',
            receipt: appointmentId,
            notes: {
                appointmentId: appointmentId,
                doctorName: appointmentData.docData.name,
                patientName: appointmentData.userData.name
            },
            payment_capture: 1
        }

        console.log("Creating Razorpay order with options:", options);

        //creation of an order
        const order = await razorpayInstance.orders.create(options);
        console.log("Razorpay order created successfully:", order);

        res.json({ 
            success: true, 
            order: {
                ...order,
                currency: options.currency // Ensure currency is passed to frontend
            }
        });

    } catch (error) {
        console.error("=== Payment Initiation Error ===");
        console.error("Error message:", error.message);
        console.error("Error details:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Failed to initiate payment" 
        });
    }
}

//API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing payment verification details" 
            });
        }

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        if (!orderInfo) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        if (orderInfo.status === "paid") {
            await appointmentModel.findByIdAndUpdate(
                orderInfo.receipt, 
                { 
                    payment: true,
                    paymentId: razorpay_payment_id,
                    paymentDate: new Date()
                }
            );
            res.json({ success: true, message: "Payment Successful" });
        } else {
            res.status(400).json({ 
                success: false, 
                message: "Payment not completed" 
            });
        }
        
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Payment verification failed" 
        });
    }
}

export { registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointmnet, cancelAppointment, paymentRazorpay, verifyRazorpay };