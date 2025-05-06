// import jwt from "jsonwebtoken";

// //user authentication middleware
// const authUser = async (req, res, next) => {
//     try {
//         const { token } = req.headers;
//         if(!token){
//             return res.json({success: false, message: "Not Authorized, Login Again"});
//         }

//         const token_decode = jwt.verify(token, process.env.JWT_SECRET);
//         req.body.userId= token_decode.id;

//         next();

//     } catch (error) {
//         console.log(error);
//         res.json({success: false, message: error.message});
//     }
// }

// export default authUser;

import jwt from "jsonwebtoken";

// user authentication middleware
const authUser = async (req, res, next) => {
    try {
        // Step 1: Get the token from Authorization header
        const authHeader = req.headers.authorization;

        // Step 2: Check if the header is present and follows the Bearer format
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Not Authorized, Login Again" });
        }

        // Step 3: Extract the token from "Bearer <token>"
        const token = authHeader.split(" ")[1];

        // Step 4: Verify the token using your secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Step 5: Attach the user ID to request body for further use
        req.body.userId = decoded.id;

        next(); // Go to the next middleware/route

    } catch (error) {
        console.log(error);
        res.status(401).json({ success: false, message: "Invalid or Expired Token" });
    }
};

export default authUser;

