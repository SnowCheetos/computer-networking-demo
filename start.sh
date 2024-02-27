#!/bin/bash

language="go"

while getopts l: flag
do
    case "${flag}" in
        l) language=${OPTARG};;
    esac
done

if [ "$language" == "go" ]; then
    go run main.go

elif [ "$language" == "py" ]; then

    redis-cli flushall

    if command -v nproc >/dev/null; then
        num_procs=$(nproc)
    elif command -v sysctl >/dev/null && sysctl -n hw.ncpu >/dev/null; then
        num_procs=$(sysctl -n hw.ncpu)
    else
        echo "Cannot determine the number of CPUs."
        exit 1
    fi

    # Calculate half the number of processors. If that's less than 1, use 1 instead.
    workers=$(( num_procs / 2 ))
    if [ "$workers" -lt 1 ]; then
        workers=1
    fi

    gunicorn main:app --workers=$workers --bind=0.0.0.0:8000 --worker-class uvicorn.workers.UvicornH11Worker

fi