import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from "../context/AppContext";
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate} from "react-router-dom";

const MyAppointments = () => {

  const { backendUrl, token, getDoctorsData } = useContext(AppContext);

  const [appointments, setAppointments] = useState([]);
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);
  const months = [" ", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Load Razorpay script
  useEffect(() => {
    const loadRazorpay = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          setIsRazorpayLoaded(true);
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          setIsRazorpayLoaded(true);
          resolve();
        };
        script.onerror = () => {
          toast.error("Failed to load payment gateway");
          resolve();
        };
        document.body.appendChild(script);
      });
    };

    loadRazorpay();
  }, []);

  const slotDateFormat = (slotDate) => {
    const dateArray = slotDate.split("_");
    return dateArray[0] + " " + months[Number(dateArray[1])] + " " + dateArray[2];
  }

  const navigate = useNavigate();

  const getUserAppointments = async () => {
    try {
      const { data } = await axios.get(
        backendUrl + "/api/user/appointments", 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setAppointments(data.appointments.reverse());
        console.log(data.appointments);
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      toast.error(error.response?.data?.message || "Failed to fetch appointments");
    }
  }

  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/user/cancel-appointment", 
        { appointmentId }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (data.success) {
        toast.success(data.message);
        getUserAppointments();
        getDoctorsData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      toast.error(error.response?.data?.message || "Failed to cancel appointment");
    }
  }

  const appointmentRazorpay = async (appointmentId) => {
    try {
        console.log("=== Starting Payment Process ===");
        console.log("Appointment ID:", appointmentId);
        console.log("Razorpay Loaded:", isRazorpayLoaded);
        console.log("Token present:", !!token);
        console.log("Backend URL:", backendUrl);

        if (!isRazorpayLoaded) {
            console.error("Payment gateway not loaded");
            toast.error("Payment gateway is not ready. Please try again in a moment.");
            return;
        }

        console.log("Making API call to create payment order...");
        const { data } = await axios.post(
            backendUrl + "/api/user/payment-razorpay", 
            { appointmentId }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log("API Response:", data);

        if (data.success) {
            console.log("Payment order created successfully:", data.order);
            initPay(data.order);
        } else {
            console.error("Payment initiation failed:", data.message);
            toast.error(data.message || "Failed to initiate payment");
        }
    } catch (error) {
        console.error("=== Payment Error Details ===");
        console.error("Error message:", error.message);
        console.error("Error response:", error.response?.data);
        console.error("Error status:", error.response?.status);
        console.error("Full error:", error);
        
        const errorMessage = error.response?.data?.message || "Failed to initiate payment";
        toast.error(errorMessage);
    }
  }

  const initPay = (order) => {
    console.log("=== Initializing Payment ===");
    console.log("Order details:", order);

    if (!isRazorpayLoaded) {
        console.error("Razorpay not loaded during initialization");
        toast.error("Payment gateway is not ready. Please try again in a moment.");
        return;
    }

    if (!window.Razorpay) {
        console.error("Razorpay object not found in window");
        toast.error("Payment gateway is not available. Please try again later.");
        return;
    }

    // Log the key being used
    console.log("Using Razorpay Key:", import.meta.env.VITE_RAZORPAY_KEY_ID);

    const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: "Appointment Payment",
        description: "Appointment Payment",
        order_id: order.id,
        receipt: order.receipt,
        handler: async (response) => {
            console.log("=== Payment Response Handler ===");
            console.log("Payment response:", response);
            
            try {
                console.log("Verifying payment with backend...");
                const { data } = await axios.post(
                    backendUrl + "/api/user/verify-razorpay", 
                    response, 
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                console.log("Verification response:", data);
                
                if (data.success) {
                    console.log("Payment verified successfully");
                    toast.success("Payment successful!");
                    getUserAppointments();
                    navigate("/my-appointments");
                } else {
                    console.error("Payment verification failed:", data.message);
                    toast.error(data.message || "Payment verification failed");
                }
            } catch (error) {
                console.error("=== Payment Verification Error ===");
                console.error("Error message:", error.message);
                console.error("Error response:", error.response?.data);
                console.error("Error status:", error.response?.status);
                console.error("Full error:", error);
                
                const errorMessage = error.response?.data?.message || "Payment verification failed";
                toast.error(errorMessage);
            }
        },
        prefill: {
            name: "Patient",
            email: "patient@example.com",
            contact: "9999999999"
        },
        theme: {
            color: "#6366f1"
        },
        modal: {
            ondismiss: function() {
                console.log("Payment modal dismissed by user");
                toast.info("Payment cancelled");
            }
        }
    };

    try {
        console.log("Opening Razorpay payment modal with options:", options);
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            console.error("Payment failed:", response.error);
            toast.error("Payment failed: " + (response.error.description || "Unknown error"));
        });
        rzp.open();
    } catch (error) {
        console.error("=== Razorpay Modal Error ===");
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        toast.error("Failed to initialize payment. Please try again.");
    }
  }

  useEffect(() => {
    if (token) {
      getUserAppointments();
    }
  }, [token]);

  return (
    <div>
      <p className='pb-3 mt-12 font-medium text-zinc-700 border-b'>My appointments</p>
      <div>
        {appointments.map((item, index) => (
          <div className='grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-2 border-b' key={index}>
            <div>
              <img className='w-32 bg-indigo-50' src={item.docData.image} alt='' />
            </div>
            <div className='flex-1 text-sm text-zinc-600'>
              <p className='text-neutral-800 font-semibold'>{item.docData.name}</p>
              <p>{item.docData.speciality}</p>
              <p className='text-zinc-700 font-medium mt-1'>Address:</p>
              <p className='text-xs'>{item.docData.address.line1}</p>
              <p className='text-xs'>{item.docData.address.line2}</p>
              <p className='text-xs mt-1'><span className='text-sm text-neutral-700 font-medium'>Date & Time:</span> {slotDateFormat(item.slotDate)} |  {item.slotTime}</p>
            </div>
            <div></div> { /* In mobile mode */ /* we have done this in order to get the buttons on the right hand side in mobile mode */}
            <div className='flex flex-col gap-2 justify-end'>
              {!item.cancelled && item.payment && !item.isCompleted && <button className='min-w-48 py-2 border rounded text-stone-500 bg-indigo-50'>Paid</button>}
              {!item.cancelled && !item.payment && !item.isCompleted && <button onClick={() => appointmentRazorpay(item._id)} className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'>Pay Online</button>}
              {!item.cancelled && !item.isCompleted && <button onClick={() => cancelAppointment(item._id)} className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'>Cancel appointment</button>}
              {item.cancelled && !item.isCompleted && <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500'>Appointment Cancelled</button>}
              {item.isCompleted && <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>Completed</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MyAppointments
