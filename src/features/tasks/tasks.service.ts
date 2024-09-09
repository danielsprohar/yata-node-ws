import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, TaskStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { PageResponse } from "../../core/model/page-response.model";
import { generateId, uuidToBuffer } from "../../core/utils/uuid.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ProjectNotFoundException } from "../projects/exception/project-not-found.exception";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryParams } from "./dto/task-query-params.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskNotFoundException } from "./exception/task-not-found.expection";
import { toTaskDto, TaskDto } from "./dto/task.dto";

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTaskDto): Promise<TaskDto> {
    if (dto.parentId) {
      const parentTaskCount = await this.prisma.task.count({
        where: {
          id: uuidToBuffer(dto.parentId),
        },
      });

      if (parentTaskCount === 0) {
        throw new TaskNotFoundException();
      }
    }

    try {
      const task = await this.prisma.task.create({
        data: {
          id: generateId(),
          name: dto.name,
          description: dto.description,
          status: dto.status,
          dueDate: dto.dueDate,
          priority: dto.priority,
          workspaceId: uuidToBuffer(dto.workspaceId),
          projectId: uuidToBuffer(dto.projectId),
          parentId: dto.parentId ? uuidToBuffer(dto.parentId) : undefined,
        },
      });

      return toTaskDto(task);
    } catch (e) {
      console.error(e);
      // @see https://www.prisma.io/docs/orm/reference/error-reference#p2003
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === "P2003") {
          throw new ProjectNotFoundException();
        }
      }

      throw new UnprocessableEntityException("Could not create the task");
    }
  }

  async findAll(params: TaskQueryParams): Promise<PageResponse<TaskDto>> {
    const {
      status,
      from,
      to,
      projectId,
      workspaceId,
      dir,
      parentId,
      priority,
    } = params;

    const page = parseInt(params.page, 10) || 0;
    const pageSize = parseInt(params.pageSize, 10) || 50;

    const taskFilter: Prisma.TaskWhereInput = {};
    if (from && to) {
      taskFilter["AND"] = {
        dueDate: {
          gte: from,
          lte: to,
        },
      };
    } else if (from) {
      taskFilter["dueDate"] = {
        gte: from,
      };
    } else if (to) {
      taskFilter["dueDate"] = {
        lte: to,
      };
    }

    if (projectId) {
      taskFilter["projectId"] = uuidToBuffer(projectId);
    }
    if (workspaceId) {
      taskFilter["project"] = {
        workspaceId: uuidToBuffer(workspaceId),
      };
    }
    if (parentId) {
      taskFilter["parentId"] = uuidToBuffer(parentId);
    }
    if (priority) {
      taskFilter["priority"] = priority;
    }
    if (status) {
      taskFilter["status"] = status;
    }

    const [data, count] = await Promise.all([
      this.prisma.task.findMany({
        skip: page * pageSize,
        take: Math.min(+pageSize, 50),
        where: taskFilter,
        orderBy: {
          createdAt: dir === "asc" ? "asc" : "desc",
        },
      }),
      this.prisma.task.count({
        where: taskFilter,
      }),
    ]);

    return {
      page,
      pageSize,
      count,
      data: data.map((task) => toTaskDto(task)),
    };
  }

  async findOne(id: string): Promise<TaskDto> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: uuidToBuffer(id),
      },
      include: {
        subtasks: true,
      },
    });

    if (!task) {
      throw new TaskNotFoundException();
    }

    return {
      ...toTaskDto(task),
      subTasks: task.subtasks.map((subTask) => toTaskDto(subTask)),
    };
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: uuidToBuffer(id),
      },
    });

    if (!task) {
      throw new TaskNotFoundException();
    }

    return this.prisma.task
      .update({
        where: {
          id: uuidToBuffer(id),
        },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          dueDate: dto.dueDate,
          priority: dto.priority,
          workspaceId: dto.workspaceId
            ? uuidToBuffer(dto.workspaceId)
            : undefined,
          projectId: dto.projectId ? uuidToBuffer(dto.projectId) : undefined,
          parentId: dto.parentId ? uuidToBuffer(dto.parentId) : undefined,
          startedAt:
            dto.status === TaskStatus.IN_PROGRESS ? new Date() : undefined,
          completedAt:
            dto.status === TaskStatus.COMPLETED ? new Date() : undefined,
        },
      })
      .then((updatedTask) => toTaskDto(updatedTask));
  }

  async remove(id: string): Promise<void> {
    const task = await this.prisma.task.delete({
      where: {
        id: uuidToBuffer(id),
      },
    });

    if (!task) {
      throw new TaskNotFoundException();
    }
  }
}
