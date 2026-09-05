


const requiresBuyerAuth = (req, res, next) => {
    if (!req.session.buyerId && !req.session.sellerId && !req.session.adminId) {
        return res.status(401).json({
            error: 'Login required'
        });
    }

    if (!req.session.buyerId) {
        return res.status(403).json({
            error: 'Buyer access required'
        });
    }

    next();
}

const requiresSellerAuth = (req, res, next) => {
    if (!req.session.buyerId && !req.session.sellerId && !req.session.adminId) {
        return res.status(401).json({
            error: 'Login required'
        });
    }

    if (!req.session.sellerId) {
        return res.status(403).json({
            error: 'Seller access required'
        });
    }

    next();
}

const requiresAdminAuth = (req, res, next) => {
    if (!req.session.buyerId && !req.session.sellerId && !req.session.adminId) {
        return res.status(401).json({
            error: 'Login required'
        });
    }

    if (!req.session.adminId) {
        return res.status(403).json({
            error: 'Admin access required'
        });
    }

    next();
}

module.exports = {
    requiresBuyerAuth,
    requiresSellerAuth,
    requiresAdminAuth
};