import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { CrmUserRepository } from './user.repository';

describe('CrmUserRepository', () => {
  it('loads an active CRM user through the auth connection', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: '7', isSuper: false });
    const getRepository = jest.fn().mockReturnValue({ findOne });
    const repository = new CrmUserRepository({
      getRepository,
    } as unknown as DataSource);

    await expect(repository.findActiveById('7')).resolves.toEqual({
      id: '7',
      isSuper: false,
    });
    expect(getRepository).toHaveBeenCalledWith(UserEntity);
    expect(findOne).toHaveBeenCalledWith({ where: { id: '7' } });
  });

  it('reports an unavailable CRM connection', async () => {
    const repository = new CrmUserRepository();

    await expect(repository.findActiveById('7')).rejects.toThrow(
      'CRM user database is unavailable',
    );
  });
});
