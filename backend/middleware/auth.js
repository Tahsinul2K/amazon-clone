


const requiresBuyerAuth = (req, res, next) => {
    if(!req.session.buyerId){
        return res.status(401).json({error: 'Buyer login required'});
    }
    next();
}

const requiresSellerAuth = (req, res, next) => {
    if(!req.session.sellerId){
        return res.status(401).json({error: 'Seller login required'});
    }
    next();
}

module.exports = {
    requiresBuyerAuth,
    requiresSellerAuth
};