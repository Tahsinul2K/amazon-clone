import { findBuyerById } from "../repositories/buyerRepository.js";

export async function getBuyerById(buyerId) {
    const buyer = await findBuyerById(buyerId);

    if (!buyer) {
        throw new Error("Buyer not found");
    }

    return buyer;
}