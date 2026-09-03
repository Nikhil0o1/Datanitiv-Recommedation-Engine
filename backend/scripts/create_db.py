import asyncio

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect("postgresql://postgres:Nikhil-700@localhost:5432/postgres")
    try:
        await conn.execute('CREATE DATABASE "cape_v2"')
        print("Database cape_v2 created")
    except asyncpg.DuplicateDatabaseError:
        print("Database cape_v2 already exists")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
