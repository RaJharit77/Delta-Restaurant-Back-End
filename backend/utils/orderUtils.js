export async function generateOrderNumber(prisma) {
    const lastOrder = await prisma.commande.findFirst({
        orderBy: { orderNumber: 'desc' }
    });

    const lastOrderNumber = lastOrder ? parseInt(lastOrder.orderNumber) : 0;
    return (lastOrderNumber + 1).toString().padStart(6, '0');
}

export async function resetOrders(prisma) {
    try {
        await prisma.commande.deleteMany({});
        console.log('Toutes les commandes ont été réinitialisées.');
    } catch (error) {
        console.error('Erreur lors de la réinitialisation des commandes:', error);
    }
}
