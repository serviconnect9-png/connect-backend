require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,

  ADMIN_EMAIL: process.env.ADMIN_EMAIL,

  FREE_JOB_POSTS: 2,

  MYSTERY_BOX_REQUIREMENT: 30,

  PLANS: {
    starter: {
      depositLimit: 100,
      withdrawLimit: 50,
      earnLimit: 300
    },

    business: {
      depositLimit: 2000,
      withdrawLimit: 500,
      earnLimit: 10000
    },

    pro: {
      depositLimit: Infinity,
      withdrawLimit: 10000,
      earnLimit: Infinity
    }
  }
};