import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/prescripto`);

        mongoose.connection.on("connected", () => console.log("Database Connected"));
    } catch (error) {
        console.log("Error connecting to database: ", error);
    }
}

export default connectDB;
