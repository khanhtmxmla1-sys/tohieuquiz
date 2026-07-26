export const mapLoginPet = (student: any) => student.pet_id ? {
    petId: student.pet_id,
    petName: student.pet_name,
    level: Number(student.pet_level) || 1,
    exp: Number(student.pet_exp) || 0,
    expToNext: Number(student.pet_exp_to_next) || 100,
    mood: student.pet_mood || 'happy',
    items: student.pet_items ? JSON.parse(student.pet_items as string) : [],
    lastActive: student.pet_last_active || '',
    imageUrl: student.pet_image_url || '',
} : null;

export const mapLoginShopItem = (item: any) => ({
    itemId: item.item_id,
    name: item.name,
    price: Number(item.price) || 0,
    type: item.type || 'ACCESSORY',
    category: item.category || '',
    assetUrl: item.asset_url || '',
});
