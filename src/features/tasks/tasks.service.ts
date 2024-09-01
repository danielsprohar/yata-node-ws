import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PageResponse } from '../../core/model/page-response.model';
import { generateId } from '../../core/utils/uuid.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectNotFoundException } from '../projects/exception/project-not-found.exception';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskNotFoundException } from './exception/task-not-found.expection';
import { TaskModel } from './model/task.model';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto): Promise<TaskModel> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: Buffer.from(createTaskDto.projectId),
      },
      select: {
        workspaceId: true,
      },
    });

    if (!project) {
      throw new ProjectNotFoundException();
    }

    if (createTaskDto.parentId) {
      const parentTaskCount = await this.prisma.task.count({
        where: {
          id: Buffer.from(createTaskDto.parentId),
        },
      });

      if (parentTaskCount === 0) {
        throw new TaskNotFoundException();
      }
    }

    const task = await this.prisma.task.create({
      data: {
        id: generateId(),
        name: createTaskDto.name,
        description: createTaskDto.description,
        status: createTaskDto.status,
        dueDate: createTaskDto.dueDate,
        priority: createTaskDto.priority,
        workspaceId: Buffer.from(project.workspaceId),
        projectId: Buffer.from(createTaskDto.projectId),
        parentId: createTaskDto.parentId
          ? Buffer.from(createTaskDto.parentId)
          : undefined,
      },
    });

    return {
      ...task,
      id: task.id.toString(),
      projectId: task.projectId.toString(),
      parentId: task.parentId?.toString(),
      workspaceId: task.workspaceId.toString(),
    };
  }

  async findAll(
    page: number,
    pageSize: number,
    projectId?: string,
    workspaceId?: string,
    status?: TaskStatus,
    from?: Date,
    to?: Date,
  ): Promise<PageResponse<TaskModel>> {
    const taskFilter = {
      status,
    };
    if (from && to) {
      taskFilter['AND'] = {
        dueDate: {
          gte: from,
          lte: to,
        },
      };
    } else if (from) {
      taskFilter['dueDate'] = {
        gte: from,
      };
    } else if (to) {
      taskFilter['dueDate'] = {
        lte: to,
      };
    }

    if (projectId) {
      taskFilter['projectId'] = Buffer.from(projectId);
    } else if (workspaceId) {
      taskFilter['project'] = {
        workspaceId: Buffer.from(workspaceId),
      };
    }

    const [data, count] = await Promise.all([
      this.prisma.task.findMany({
        skip: page * pageSize,
        take: Math.min(pageSize, 50),
        where: taskFilter,
      }),
      this.prisma.task.count({
        where: taskFilter,
      }),
    ]);

    return {
      page,
      pageSize,
      count,
      data: data.map((task) => ({
        ...task,
        id: task.id.toString(),
        projectId: task.projectId.toString(),
        parentId: task.parentId?.toString(),
        workspaceId: task.workspaceId.toString(),
      })),
    };
  }

  async findOne(id: string): Promise<TaskModel> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: Buffer.from(id),
      },
      include: {
        subTasks: true,
      },
    });

    if (!task) {
      throw new TaskNotFoundException();
    }

    return {
      ...task,
      id: task.id.toString(),
      projectId: task.projectId.toString(),
      parentId: task.parentId?.toString(),
      workspaceId: task.workspaceId.toString(),
      subTasks: task.subTasks.map((subTask) => ({
        ...subTask,
        id: subTask.id.toString(),
        projectId: subTask.projectId.toString(),
        parentId: subTask.parentId?.toString(),
        workspaceId: task.workspaceId.toString(),
      })),
    };
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<TaskModel> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: Buffer.from(id),
      },
    });

    if (!task) {
      throw new TaskNotFoundException();
    }

    return this.prisma.task
      .update({
        where: {
          id: Buffer.from(id),
        },
        data: {
          name: updateTaskDto.name,
          description: updateTaskDto.description,
          status: updateTaskDto.status,
          dueDate: updateTaskDto.dueDate,
          priority: updateTaskDto.priority,
          projectId: updateTaskDto.projectId
            ? Buffer.from(updateTaskDto.projectId)
            : undefined,
          parentId: updateTaskDto.parentId
            ? Buffer.from(updateTaskDto.parentId)
            : undefined,
          completedAt:
            updateTaskDto.status === TaskStatus.COMPLETED
              ? new Date()
              : undefined,
        },
      })
      .then((updatedTask) => ({
        ...updatedTask,
        id: updatedTask.id.toString(),
        projectId: updatedTask.projectId.toString(),
        parentId: updatedTask.parentId?.toString(),
        workspaceId: task.workspaceId.toString(),
      }));
  }

  async remove(id: string): Promise<void> {
    const task = await this.prisma.task.delete({
      where: {
        id: Buffer.from(id),
      },
    });

    if (!task) {
      throw new TaskNotFoundException();
    }
  }
}
