const { UserTransactions, Users } = require('../../models/index');


async function fixTransactions() {
  try {
    let users = await Users.findAll();
    users = users.map(user => ({ email: user.email, userId: user.userId }));
    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      const transactions = await UserTransactions.findAll({
        where: {
          userId: user.userId,
        },
      });
      let promo = 0;
      let earnings = 0;
      let recharged = 0;
      let fees = 0;
      const transactionsToAdd = [];
      for (let tIndex = 0; tIndex < transactions.length; tIndex++) {
        const oneTransaction = transactions[tIndex];
        switch (oneTransaction.sourceType) {
          case 'rideRevenue':
            earnings += oneTransaction.amount;
            break;
          case 'manualGift':
          case 'promo':
            promo += oneTransaction.amount;
            break;
          case 'balanceRecharge':
          case 'balanceRechargeFees':
            recharged += oneTransaction.amount;
            break;
          case 'rideFees':
            fees += oneTransaction.amount;
            let remaining = -oneTransaction.amount;
            if (promo > 0) {
              // Check promo
              if (promo >= remaining) {
                transactionsToAdd.push({ sourceType: 'promo', value: -remaining });
              } else {
                transactionsToAdd.push({ sourceType: 'promo', value: -promo });
                promo = 0;
                remaining -= promo;
              }
            }
            if (remaining === 0) {
              break;
            }
            // Check Earnings
            if (earnings > 0) {
              if (earnings >= remaining) {
                transactionsToAdd.push({ sourceType: 'rideRevenue', value: -remaining });
              } else {
                transactionsToAdd.push({ sourceType: 'rideRevenue', value: -earnings });
                earnings = 0;
                remaining -= earnings;
              }
            }
            if (remaining === 0) {
              break;
            }
            // Check Charge
            if (recharged > 0) {
              if (recharged >= remaining) {
                transactionsToAdd.push({ sourceType: 'balanceRecharge', value: -remaining });
              } else {
                transactionsToAdd.push({ sourceType: 'balanceRecharge', value: -recharged });
                recharged = 0;
                remaining -= recharged;
              }
            }
            break;
          default: console.log('Ignoring source type', oneTransaction.sourceType);
        }
      }
      if (fees < 0) {
        console.log({
          user: user.userId, transactions: transactionsToAdd, earnings, promo, recharged, fees,
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

fixTransactions()
  .catch((err) => {
    console.error(err);
  })
  .then(() => process.exit());
