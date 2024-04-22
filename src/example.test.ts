import {
    BaseEntity,
    Entity,
    MikroORM,
    PrimaryKey,
    Property,
    Collection as MikroCollection,
    ManyToMany,
} from '@mikro-orm/sqlite';

@Entity()
class Product extends BaseEntity {
    @PrimaryKey()
    id!: number;

    @Property()
    sku!: string;

    @ManyToMany(() => Collection, (collection) => collection.matchProducts)
    matchCollections = new MikroCollection<Collection>(this);

    @ManyToMany(() => Collection, (collection) => collection.fetchProducts)
    fetchCollections = new MikroCollection<Collection>(this);
}

@Entity()
class Collection extends BaseEntity {
    @PrimaryKey()
    id!: number;

    @Property()
    priority = 0;

    @ManyToMany(() => Product)
    matchProducts = new MikroCollection<Product>(this);

    @ManyToMany(() => Product)
    fetchProducts = new MikroCollection<Product>(this);
}

let orm: MikroORM;

beforeAll(async () => {
    orm = await MikroORM.init({
        dbName: ':memory:',
        entities: [Product, Collection],
        debug: ['query', 'query-params'],
        allowGlobalContext: true, // only for testing
    });
    await orm.schema.refreshDatabase();
});

afterAll(async () => {
    await orm.close(true);
});

test('basic CRUD example', async () => {
    const product1 = orm.em.create(Product, {
        sku: '123',
    });

    const product2 = orm.em.create(Product, {
        sku: '234',
    });

    const product3 = orm.em.create(Product, {
        sku: '345',
    });

    orm.em.create(Collection, {
        priority: 1,
        matchProducts: [product1, product2],
        fetchProducts: [product3],
    });

    orm.em.create(Collection, {
        priority: 2,
        matchProducts: [product1, product2],
        fetchProducts: [product3],
    });

    await orm.em.flush();

    orm.em.clear();

    const product = await orm.em.findOneOrFail(Product, {
        sku: '123',
    });

    const qb = orm.em.getRepository(Product).createQueryBuilder('product')
        .leftJoin('fetchCollections', 'collection')
        .where(
            `EXISTS (
                SELECT 1
                FROM collection_match_products
                WHERE collection_id = collection.id
                AND product_id = ?)
            `,
            [product.id],
        )
        .orderBy({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'collection.priority': 'DESC',
        })
        .limit(25);

    const results = await qb.getResultList();

    expect(results).toHaveLength(1);
});
