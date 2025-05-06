import { createContext, useEffect, useState } from "react";
import axios from "axios";
import {toast} from "react-toastify";

export const AppContext = createContext();

const AppContextProvider = (props) => {
    const currencySymbol = "₹";
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [doctors, setDoctors] = useState([]);
    const [token, setToken] = useState(() => {
        const storedToken = localStorage.getItem("token");
        return storedToken || false;
    });
    const [userData, setUserData] = useState(false);

    const getDoctorsData = async () => {
        try {
            const {data} = await axios.get(backendUrl + "/api/doctor/list");
            if (data.success) {
                setDoctors(data.doctors);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }

    const loadUserProfileData = async () => {
        // Clear user data if no token
        if (!token) {
            setUserData(false);
            return;
        }

        try {
            const {data} = await axios.get(
                backendUrl + '/api/user/get-profile', 
                {headers: {Authorization: `Bearer ${token}`}}
            );
            
            if (data.success) {
                setUserData(data.userData);
            } else {
                // If the request fails, clear the token and user data
                localStorage.removeItem("token");
                setToken(false);
                setUserData(false);
                toast.error(data.message);
            }
        } catch (error) {
            // If there's an error, clear the token and user data
            localStorage.removeItem("token");
            setToken(false);
            setUserData(false);
            toast.error("Session expired. Please login again.");
        }
    }

    // Update token in localStorage whenever it changes
    useEffect(() => {
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token");
        }
    }, [token]);

    // Load user data when token changes
    useEffect(() => {
        loadUserProfileData();
    }, [token]);

    // Load doctors data on mount
    useEffect(() => {
        getDoctorsData();
    }, []);

    const value = {
        doctors, 
        getDoctorsData,
        currencySymbol,
        token, 
        setToken,
        backendUrl,
        userData, 
        setUserData,
        loadUserProfileData
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}

export default AppContextProvider;