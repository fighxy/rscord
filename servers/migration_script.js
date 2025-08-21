// MongoDB Migration Script: RSCord -> Radiate
// Run with: mongosh --file migration_script.js

print("=== Starting Radiate Migration ===");

// Connect to the database
const sourceDb = db.getSiblingDB('rscord');  // Old database
const targetDb = db.getSiblingDB('radiate'); // New database

print("Connected to databases");

// 1. Migrate Users Collection
print("Migrating users collection...");
const usersCount = sourceDb.users.countDocuments();
print(`Found ${usersCount} users to migrate`);

if (usersCount > 0) {
    const users = sourceDb.users.find().toArray();
    
    // Transform user documents for Telegram-only auth
    const transformedUsers = users.map(user => {
        const transformed = {
            _id: user._id,
            telegram_id: user.telegram_id || 0, // Required field now
            telegram_username: user.telegram_username || null,
            username: user.username,
            display_name: user.display_name,
            created_at: user.created_at
        };
        
        // Only migrate users that have telegram_id
        if (user.telegram_id) {
            return transformed;
        } else {
            print(`Skipping user ${user.username} - no telegram_id`);
            return null;
        }
    }).filter(Boolean);
    
    print(`Migrating ${transformedUsers.length} users with telegram_id`);
    if (transformedUsers.length > 0) {
        targetDb.users.insertMany(transformedUsers);
        print("✅ Users migrated successfully");
    }
}

// 2. Create indexes for new database
print("Creating indexes...");

// Unique index on telegram_id (required)
targetDb.users.createIndex({ "telegram_id": 1 }, { unique: true });
print("✅ Created unique index on telegram_id");

// Unique index on username
targetDb.users.createIndex({ "username": 1 }, { unique: true });
print("✅ Created unique index on username");

// 3. Migrate other collections if they exist
const collections = ['messages', 'channels', 'guilds', 'voice_sessions'];

collections.forEach(collName => {
    const count = sourceDb.getCollection(collName).countDocuments();
    if (count > 0) {
        print(`Migrating ${collName}: ${count} documents`);
        const docs = sourceDb.getCollection(collName).find().toArray();
        targetDb.getCollection(collName).insertMany(docs);
        print(`✅ Migrated ${collName}`);
    } else {
        print(`⚠️ Collection ${collName} is empty or doesn't exist`);
    }
});

print("=== Migration Summary ===");
print(`Target database: radiate`);
print(`Users migrated: ${targetDb.users.countDocuments()}`);
print(`Total collections: ${targetDb.getCollectionNames().length}`);

print("=== Migration Complete ===");
print("Note: Original 'rscord' database is preserved for backup");