import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const products = ["Summer Collection", "Winter Jacket", "Running Shoes", "Cotton T-Shirt", "Leather Wallet", "Designer Sunglasses", "Denim Jeans", "Smart Watch"];

function getFeedback(rating: number): string {
  if (rating === 1) return randomElement(["Terrible support.", "Shipping took forever.", "Item arrived damaged.", "Too expensive for the quality.", "Completely unresponsive."]);
  if (rating === 2) return randomElement(["Not great, but okay.", "Could be better.", "A bit disappointed.", "Overpriced.", "Average experience."]);
  if (rating === 3) return randomElement(["It was fine.", "Met expectations.", "Decent.", "Nothing special.", "Okay."]);
  if (rating === 4) return randomElement(["Pretty good!", "I liked it.", "Good value.", "Fast shipping.", "Will buy again."]);
  return randomElement(["Incredible shipping speed!", "Absolutely love it!", "Best purchase ever.", "Amazing customer service.", "Highly recommended!"]);
}

async function main() {
  console.log("Seeding database...");
  
  // Clear existing data
  await prisma.communicationLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();

  const customersData = [];
  
  for (let i = 0; i < 1000; i++) {
    const fn = randomElement(firstNames);
    const ln = randomElement(lastNames);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@example.com`;
    const phone = `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`;
    
    customersData.push({
      name: `${fn} ${ln}`,
      email,
      phone,
      createdAt: randomDate(new Date(2023, 0, 1), new Date()),
    });
  }

  // Insert customers
  console.log("Inserting customers...");
  await prisma.customer.createMany({
    data: customersData
  });

  const allCustomers = await prisma.customer.findMany();
  
  console.log("Generating orders...");
  let orderCount = 0;
  
  // Generate orders for some customers
  for (const customer of allCustomers) {
    const numOrders = Math.floor(Math.random() * 5); // 0 to 4 orders
    
    let totalSpent = 0;
    let lastVisit = customer.createdAt;
    
    for (let j = 0; j < numOrders; j++) {
      const amount = Math.round((Math.random() * 200 + 10) * 100) / 100;
      const date = randomDate(customer.createdAt, new Date());
      const productName = randomElement(products);
      const quantity = Math.floor(Math.random() * 3) + 1;
      
      totalSpent += amount;
      if (date > lastVisit) lastVisit = date;
      
      await prisma.order.create({
        data: {
          customerId: customer.id,
          amount,
          date,
          productName,
          quantity
        }
      });
      orderCount++;
    }
    
    let profileSegment = "Low";
    if (totalSpent > 500) profileSegment = "High";
    else if (totalSpent >= 200) profileSegment = "Medium";

    const satisfactionRating = Math.floor(Math.random() * 5) + 1; // 1 to 5
    const feedbackComment = getFeedback(satisfactionRating);

    // Update customer with total spent, segment, rating, feedback, and last visit
    if (numOrders > 0) {
       await prisma.customer.update({
         where: { id: customer.id },
         data: {
           totalSpent: Math.round(totalSpent * 100) / 100,
           profileSegment,
           satisfactionRating,
           feedbackComment,
           lastVisit
         }
       });
    }
  }

  console.log(`Seeding finished. Created 1000 customers and ${orderCount} orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
